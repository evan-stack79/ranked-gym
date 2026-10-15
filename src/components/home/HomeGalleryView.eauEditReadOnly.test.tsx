/** @vitest-environment jsdom */
/**
 * Accueil edit/reorder must never write water journal data (local or cloud).
 * Drag Eau before async water load, exit edit → day's total unchanged,
 * no 0 / empty overwrite in localStorage or cloud backup notify.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { isLoading: true }

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
    isLoading: authState.isLoading,
  }),
}))

let waterMl = 0
const notifyLocalDataChanged = vi.fn()

vi.mock('../../services/nutritionStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/nutritionStorage')>()
  return {
    ...actual,
    getTodayWaterMl: () => waterMl,
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
    getTodayWaterEntries: vi.fn(() => {
      // Side-effecting reader — Accueil must not call it.
      throw new Error('Accueil must not call getTodayWaterEntries')
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

describe('HomeGalleryView Eau edit is read-only for water', () => {
  let host: HTMLDivElement
  let root: Root
  let journalBefore: string | null

  beforeEach(() => {
    authState.isLoading = true
    waterMl = 0
    notifyLocalDataChanged.mockClear()
    localStorage.clear()
    // Pre-seed a real day's water journal that must survive edit.
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

  it('edit + drag Eau before water load does not write 0 / empty water log', async () => {
    const storage = await import('../../services/nutritionStorage')
    const { HomeGalleryView } = await import('./HomeGalleryView')
    const { reorderVisibleAccueilWidget, loadAccueilWidgetPrefs, saveAccueilWidgetPrefs } =
      await import('../../utils/accueilWidgetPrefs')

    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    // Loading: placeholder, not 0 ml.
    expect(host.querySelector('[data-accueil-eau-placeholder="1"]')).toBeTruthy()
    expect(host.textContent).not.toMatch(/\b0\s*ml\b/)

    const openBtn = host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement
    await act(async () => {
      openBtn.click()
    })
    expect(host.querySelector('[data-accueil-edit-open="1"]')).toBeTruthy()

    // Simulate reorder (same path as drag drop) while water still unloaded.
    await act(async () => {
      const prefs = loadAccueilWidgetPrefs()
      saveAccueilWidgetPrefs(
        reorderVisibleAccueilWidget(prefs, 'eau', 'seances_semaine', Date.now()),
      )
      window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
    })

    // Async water arrives after edit interactions.
    waterMl = 1200
    authState.isLoading = false
    await act(async () => {
      window.dispatchEvent(new Event('ranked-gym:water-changed'))
    })

    const okBtn = host.querySelector('[data-accueil-edit-ok]') as HTMLButtonElement
    await act(async () => {
      okBtn?.click()
    })

    // Day's water total identical; journal untouched; no cloud notify of a 0 overwrite.
    expect(storage.getTodayWaterMl()).toBe(1200)
    expect(localStorage.getItem('ranked-gym:nutrition-journal')).toBe(journalBefore)
    expect(notifyLocalDataChanged).not.toHaveBeenCalled()
    expect(storage.addWaterEntry).not.toHaveBeenCalled()
    expect(storage.saveJournalForDate).not.toHaveBeenCalled()
    expect(storage.setWaterTotalFromGauge).not.toHaveBeenCalled()

    // After load, tile shows 1200 — never persisted a flash 0.
    expect(host.textContent?.replace(/\s/g, '')).toContain('1200')
    expect(host.textContent).not.toMatch(/\b0\s*ml\b/)
  })
})
