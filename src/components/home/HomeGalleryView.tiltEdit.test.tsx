/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { packAccueilWidgets } from './HomeGalleryView'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
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
  }
})

vi.mock('../../services/trainingStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/trainingStorage')>()
  const weekday = new Date().getDay()
  return {
    ...actual,
    getTrainingState: () => ({
      ...actual.getTrainingState(),
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
      schedule: [
        {
          id: 'sch-1',
          templateId: 'tpl-push',
          title: 'Push',
          days: [weekday],
          time: '18:00',
          enabled: true,
          sportId: 'musculation',
          sessionKind: 'strength',
        },
      ],
      workoutNotes: [],
      routines: [
        {
          id: 'push',
          label: 'Push',
          subtitle: 'Poussée',
          accent: '#FF2B2B',
          updatedAt: Date.now(),
          exercises: [
            {
              id: 'e1',
              name: 'Développé couché',
              canonicalExerciseId: 'bench_press',
              sets: [
                { reps: 8, weightKg: 60, done: true },
                { reps: 8, weightKg: 60 },
              ],
            },
          ],
        },
      ],
      lastSelectedRoutineId: 'push',
      lastSelectedSportId: 'musculation',
      activeWorkoutDraft: {
        routineId: 'push',
        sportId: 'musculation',
        startedAt: Date.now() - 1000,
        updatedAt: Date.now(),
      },
      lastVoluntaryRoute: 'train-hub',
      sportsOnboardingComplete: true,
    }),
  }
})

describe('packAccueilWidgets', () => {
  it('packs consecutive small tiles into rows of two', () => {
    expect(
      packAccueilWidgets(['seance', 'eau', 'series_jour', 'programme', 'prochaine_seance']),
    ).toEqual([
      { kind: 'wide', id: 'seance' },
      { kind: 'row', ids: ['eau', 'series_jour'] },
      { kind: 'wide', id: 'programme' },
      { kind: 'wide', id: 'prochaine_seance' },
    ])
  })
})

describe('TiltCard disabled in Accueil edit mode', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    localStorage.removeItem('ranked-gym:accueil-widget-prefs')
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('disables Tilt while in-place edit mode is on', async () => {
    const { HomeGalleryView } = await import('./HomeGalleryView')

    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    expect(host.querySelector('[data-accueil-edit-open="0"]')).toBeTruthy()
    expect(host.querySelector('[data-rg-tilt]')?.getAttribute('data-rg-tilt')).toBe('on')

    const openBtn = host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement
    await act(async () => {
      openBtn.click()
    })

    expect(host.querySelector('[data-accueil-edit-open="1"]')).toBeTruthy()
    expect(host.querySelector('[data-accueil-edit-ok]')).toBeTruthy()
    expect(host.querySelector('[data-accueil-edit-add]')).toBeTruthy()
    expect(host.querySelector('[data-accueil-tile-trash]')).toBeTruthy()
    expect(host.querySelector('[data-rg-tilt]')?.getAttribute('data-rg-tilt')).toBe('off')
  })

  it('keeps Tilt off and edit chrome while long-press edit is open (#99 compatible)', async () => {
    const { HomeGalleryView } = await import('./HomeGalleryView')
    const { ACCUEIL_LONG_PRESS_MS, ACCUEIL_LONG_PRESS_MOVE_PX } = await import(
      '../../utils/accueilEditGestures'
    )
    expect(ACCUEIL_LONG_PRESS_MS).toBe(500)
    expect(ACCUEIL_LONG_PRESS_MOVE_PX).toBe(10)

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
    await act(async () => {
      openBtn.click()
    })

    expect(host.querySelector('[data-accueil-edit-open="1"]')).toBeTruthy()
    expect(host.querySelector('[data-rg-tilt]')?.getAttribute('data-rg-tilt')).toBe('off')
    expect(host.querySelector('.accueil-edit-slot--editing')).toBeTruthy()
  })

  it('keeps Reveal instant after leaving edit (no mask re-hide / black flash)', async () => {
    const { HomeGalleryView } = await import('./HomeGalleryView')

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
    await act(async () => {
      openBtn.click()
    })

    const masksWhileEditing = [...host.querySelectorAll('.rg-mask-reveal')]
    expect(masksWhileEditing.length).toBeGreaterThan(0)
    for (const mask of masksWhileEditing) {
      expect(mask.className).toContain('rg-mask-reveal--instant')
      expect(mask.className).toContain('rg-mask-reveal--in')
    }
    expect(host.querySelectorAll('[data-rg-reveal="pending"]').length).toBe(0)

    const okBtn = host.querySelector('[data-accueil-edit-ok]') as HTMLButtonElement
    await act(async () => {
      okBtn.click()
    })

    expect(host.querySelector('[data-accueil-edit-open="0"]')).toBeTruthy()
    expect(host.querySelectorAll('[data-rg-reveal="pending"]').length).toBe(0)
    const masksAfterExit = [...host.querySelectorAll('.rg-mask-reveal')]
    expect(masksAfterExit.length).toBeGreaterThan(0)
    for (const mask of masksAfterExit) {
      // freezeReveals stays true — dropping --instant would restart
      // rg-mask-reveal-up from inset(100%) (black frame).
      expect(mask.className).toContain('rg-mask-reveal--instant')
      expect(mask.className).toContain('rg-mask-reveal--in')
    }
  })
})
