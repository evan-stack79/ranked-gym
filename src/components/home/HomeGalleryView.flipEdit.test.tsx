/** @vitest-environment jsdom */
/**
 * Accueil edit FLIP: reduced motion stays instant; reorder prefs unchanged by animation;
 * Eau remains read-only during edit (no water writes).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadAccueilWidgetPrefs,
  reorderVisibleAccueilWidget,
  resolveVisibleAccueilWidgets,
  saveAccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import { ACCUEIL_FLIP_MS, shouldAnimateFlip } from '../../utils/accueilFlip'
import { HomeGalleryView } from './HomeGalleryView'

const reducedMotion = { current: false }

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotion.current,
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

vi.mock('../../services/nutritionStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/nutritionStorage')>()
  return {
    ...actual,
    getTodayWaterMl: () => 900,
    addWaterEntry: vi.fn(() => {
      throw new Error('Accueil must not call addWaterEntry')
    }),
    setTodayWaterMl: vi.fn(() => {
      throw new Error('Accueil must not call setTodayWaterMl')
    }),
  }
})

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

describe('Accueil edit FLIP / reduced motion', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    reducedMotion.current = false
    localStorage.clear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('reorderVisibleAccueilWidget result is independent of FLIP duration', () => {
    const base = loadAccueilWidgetPrefs()
    const a = reorderVisibleAccueilWidget(base, 'eau', 'seances_semaine', 1)
    const b = reorderVisibleAccueilWidget(base, 'eau', 'seances_semaine', 1)
    expect(resolveVisibleAccueilWidgets(a)).toEqual(resolveVisibleAccueilWidgets(b))
    expect(ACCUEIL_FLIP_MS).toBe(220)
    expect(shouldAnimateFlip(40, 0)).toBe(true)
  })

  it('reduced motion: edit mode uses dashed outline, no wiggle / entering class', async () => {
    reducedMotion.current = true
    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    const openBtn = host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement
    expect(openBtn).toBeTruthy()
    await act(async () => {
      openBtn.click()
    })

    expect(host.querySelector('[data-accueil-edit-open="1"]')).toBeTruthy()
    expect(host.querySelector('.accueil-edit-slot--dashed')).toBeTruthy()
    expect(host.querySelector('.accueil-edit-slot--wiggle')).toBeNull()
    expect(host.querySelector('[data-accueil-entering="1"]')).toBeNull()
  })

  it('edit reorder via prefs keeps Eau visible with stable water text (no 0 ml)', async () => {
    const prefs = loadAccueilWidgetPrefs()
    saveAccueilWidgetPrefs(
      reorderVisibleAccueilWidget(prefs, 'eau', 'seances_semaine', Date.now()),
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

    await act(async () => {
      ;(host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement).click()
    })

    const eau = host.querySelector('[data-accueil-edit-slot="eau"]')
    expect(eau).toBeTruthy()
    const text = eau?.textContent ?? ''
    expect(text).not.toMatch(/\b0\s*ml\b/i)
    expect(text).toMatch(/900/)
  })
})
