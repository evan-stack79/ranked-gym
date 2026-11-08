/** @vitest-environment jsdom */
/**
 * M1 — Accueil n’affiche plus la tuile Eau legacy.
 * Edit/reorder ne doit jamais écrire dans le journal eau legacy.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

vi.mock('../../hooks/useInViewOnce', () => ({
  useInViewOnce: () => ({ ref: { current: null }, inView: true }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { firstName: 'Alex', displayName: 'Alex' },
    profile: { pseudo: 'Alex' },
    isLoading: false,
  }),
}))

const notifyLocalDataChanged = vi.fn()

vi.mock('../../services/nutritionStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/nutritionStorage')>()
  return {
    ...actual,
    addWaterEntry: vi.fn(() => {
      throw new Error('Accueil must not call addWaterEntry')
    }),
    addWaterEntryForDate: vi.fn(() => {
      throw new Error('Accueil must not call addWaterEntryForDate')
    }),
    setWaterTotalFromGauge: vi.fn(() => {
      throw new Error('Accueil must not call setWaterTotalFromGauge')
    }),
    setTodayWaterMl: vi.fn(() => {
      throw new Error('Accueil must not call setTodayWaterMl')
    }),
    saveJournalForDate: vi.fn((...args: unknown[]) => {
      throw new Error(`Accueil must not call saveJournalForDate: ${JSON.stringify(args)}`)
    }),
    saveTodayJournal: vi.fn(() => {
      throw new Error('Accueil must not call saveTodayJournal')
    }),
  }
})

vi.mock('../../services/cloudBackup', () => ({
  notifyLocalDataChanged: (...args: unknown[]) => notifyLocalDataChanged(...args),
  hydrateCloudBackup: vi.fn(),
  triggerCloudBackup: vi.fn(),
}))

vi.mock('../../services/trainingStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/trainingStorage')>()
  return {
    ...actual,
    getTrainingState: () => ({
      ...actual.getTrainingState(),
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
      schedule: [],
      workoutNotes: [],
      routines: [],
      sportsOnboardingComplete: true,
      lastVoluntaryRoute: 'train-hub',
    }),
  }
})

describe('HomeGalleryView M1 — pas de tuile Eau legacy', () => {
  let host: HTMLDivElement
  let root: Root
  let journalBefore: string | null

  beforeEach(() => {
    notifyLocalDataChanged.mockClear()
    localStorage.clear()
    const dateKey = new Date().toISOString().slice(0, 10)
    const journal = {
      [dateKey]: {
        dateKey,
        meals: [],
        waterMl: 1200,
        waterEntries: [
          {
            id: 'w1',
            amountMl: 1200,
            createdAt: Date.now(),
            type: 'bottle',
            label: 'Bouteille',
          },
        ],
      },
    }
    localStorage.setItem('ranked-gym:nutrition-journal', JSON.stringify(journal))
    journalBefore = localStorage.getItem('ranked-gym:nutrition-journal')
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    localStorage.clear()
  })

  it('edit Accueil n’affiche pas eau et ne touche pas le journal legacy', async () => {
    const storage = await import('../../services/nutritionStorage')
    const { HomeGalleryView } = await import('./HomeGalleryView')
    const { reorderVisibleAccueilWidget, loadAccueilWidgetPrefs, saveAccueilWidgetPrefs } =
      await import('../../utils/accueilWidgetPrefs')

    saveAccueilWidgetPrefs(
      reorderVisibleAccueilWidget(loadAccueilWidgetPrefs(), 'eau', 'seances_semaine', Date.now()),
    )

    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    expect(host.querySelector('[data-accueil-slot="eau"]')).toBeNull()
    expect(host.querySelector('[data-accueil-eau-placeholder="1"]')).toBeNull()

    const openBtn = host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement
    await act(async () => {
      openBtn.click()
    })
    expect(host.querySelector('[data-accueil-edit-slot="eau"]')).toBeNull()

    const okBtn = host.querySelector('[data-accueil-edit-ok]') as HTMLButtonElement
    await act(async () => {
      okBtn?.click()
    })

    expect(storage.getTodayWaterMl()).toBe(1200)
    expect(localStorage.getItem('ranked-gym:nutrition-journal')).toBe(journalBefore)
    expect(notifyLocalDataChanged).not.toHaveBeenCalled()
    expect(storage.addWaterEntry).not.toHaveBeenCalled()
    expect(storage.saveJournalForDate).not.toHaveBeenCalled()
    expect(storage.setWaterTotalFromGauge).not.toHaveBeenCalled()
  })
})
