/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingView } from './TrainingView'
import { AuthStateProvider } from '../../context/AuthContext'
import { RestTimerProvider } from '../../context/RestTimerContext'
import { buildAuthContextValue } from '../../test/authFixtureValue'
import { saveCalorieProfile } from '../../services/nutritionStorage'
import { appendExerciseToActiveRoutine } from '../../services/trainingStorage'

vi.mock('../../assets/brand/panther-roaring.png', () => ({ default: 'panther.png' }))
vi.mock('../../services/restTimerLiveActivity', () => ({
  startRestLiveActivity: vi.fn(),
  updateRestLiveActivity: vi.fn(),
  endRestLiveActivity: vi.fn(),
}))
vi.mock('../../utils/restTimerSound', () => ({ playRestCompleteChime: vi.fn() }))
vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))

const NOW = Date.parse('2026-09-23T10:00:00.000Z')

function seedHub(kind: 'bench' | 'incline' | 'empty') {
  const notes =
    kind === 'empty'
      ? []
      : [
          {
            id: 'fix-hub-1',
            title: 'Push fixture',
            routineId: 'push',
            dateKey: '2026-09-21',
            createdAt: NOW - 2 * 86400000,
            durationMin: 42,
            sessionKind: 'strength',
            sportId: 'musculation',
            exercises: [
              {
                id: 'ex-1',
                name: kind === 'bench' ? 'Développé couché' : 'Développé incliné',
                canonicalExerciseId: kind === 'bench' ? 'bench_press' : 'incline_bench_press',
                sets: [
                  { reps: 8, weightKg: 60, done: true },
                  { reps: 8, weightKg: 60, done: true },
                ],
              },
            ],
          },
          {
            id: 'fix-hub-2',
            title: 'Push fixture 2',
            dateKey: '2026-09-18',
            createdAt: NOW - 5 * 86400000,
            durationMin: 30,
            sessionKind: 'strength',
            sportId: 'musculation',
            exercises: [
              {
                id: 'ex-2',
                name: kind === 'bench' ? 'Développé couché' : 'Développé incliné',
                canonicalExerciseId: kind === 'bench' ? 'bench_press' : 'incline_bench_press',
                sets: [{ reps: 8, weightKg: 55, done: true }],
              },
            ],
          },
        ]
  localStorage.setItem(
    'ranked-gym:training',
    JSON.stringify({
      primarySportId: 'musculation',
      favoriteSportIds: kind === 'empty' ? ['tennis'] : ['musculation'],
      sportsOnboardingComplete: true,
      stepsToday: 0,
      stepsDateKey: '2026-09-23',
      healthLinked: false,
      notificationsEnabled: false,
      templates: [],
      schedule: [],
      completed: [],
      workoutNotes: notes,
      routines: [{ id: 'upper', label: 'Upper', subtitle: '', accent: '#FF2B2B', exercises: [], updatedAt: 0 }],
      lastSelectedRoutineId: null,
      lastSelectedSportId: null,
      lastVoluntaryRoute: 'train-hub',
      activeWorkoutDraft: null,
      dismissedExerciseIds: [],
    }),
  )
  saveCalorieProfile({
    weightKg: 78,
    goalWeightKg: 80,
    heightCm: 180,
    age: 28,
    sex: 'male',
    activity: 'active',
    morphology: 'mesomorph',
    goal: 'bulk',
    weeklyPaceKg: 0.5,
    onboardingComplete: true,
  })
}

async function renderHub() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const value = buildAuthContextValue({ isAuthenticated: false, isLoading: false })
  await act(async () => {
    root.render(
      <AuthStateProvider value={value}>
        <RestTimerProvider>
          <TrainingView />
        </RestTimerProvider>
      </AuthStateProvider>,
    )
  })
  return {
    host,
    async cleanup() {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('accueil Train — maquette unique', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('n’affiche que les blocs maquette, une reco, une dernière séance', async () => {
    seedHub('bench')
    const { host, cleanup } = await renderHub()
    expect(host.querySelector('[data-training-hub]')).toBeTruthy()
    expect(host.textContent).toContain('Train')
    expect(host.querySelectorAll('[data-training-reco]').length).toBe(1)
    expect(host.querySelector('[data-canonical-exercise]')?.getAttribute('data-canonical-exercise')).toBe(
      'bench_press',
    )
    expect(host.textContent).toContain('Commencer avec cet exercice')
    expect(host.textContent).toContain('Tu pourras compléter ta séance ensuite')
    expect(host.textContent).toContain('Dernière séance')
    expect(host.querySelectorAll('[data-last-session]').length).toBe(1)
    expect(host.textContent).not.toContain('Choisir une activité')
    expect(host.textContent).not.toContain('AUJOURD’HUI')
    expect(host.querySelector('[aria-label="Réglages"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Carnet')
    expect(host.textContent).not.toContain('Programmes')
    expect(host.textContent).not.toContain('Historique')
    expect(host.querySelector('[role="tablist"]')).toBeNull()
    expect(host.querySelector('[data-week-summary]')).toBeTruthy()
    expect(host.textContent).not.toMatch(/\bTout\b/)
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Muscu')).toBe(
      false,
    )
    expect(host.querySelectorAll('[data-training-reco]').length).toBeLessThan(2)
    await cleanup()
  })

  it('données dynamiques : autre fixture → autre id canonique', async () => {
    seedHub('incline')
    const { host, cleanup } = await renderHub()
    const id = host.querySelector('[data-canonical-exercise]')?.getAttribute('data-canonical-exercise')
    expect(id).toBe('incline_bench_press')
    expect(host.querySelector('[data-reco-name]')?.getAttribute('data-reco-name')).toBe(
      'Développé incliné',
    )
    expect(host.textContent).not.toContain('12 min')
    await cleanup()
  })

  it('sans candidat → pas de carte fake', async () => {
    seedHub('empty')
    const { host, cleanup } = await renderHub()
    expect(host.querySelector('[data-training-reco]')).toBeNull()
    expect(host.querySelector('[data-training-reco-empty]')).toBeTruthy()
    await cleanup()
  })

  it('Commencer avec cet exercice ouvre la 1re série de l’exercice recommandé', async () => {
    seedHub('bench')
    const { host, cleanup } = await renderHub()
    const cta = [...host.querySelectorAll('button')].find((el) =>
      el.textContent?.includes('Commencer avec cet exercice'),
    )
    expect(cta).toBeTruthy()
    await act(async () => {
      cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-training-hub]')).toBeNull()
    expect(host.querySelector('[aria-label="Série 1 poids"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Série 1 reps"]')).toBeTruthy()
    expect(host.querySelectorAll('[data-set-row="active"]').length).toBe(1)
    const stored = JSON.parse(localStorage.getItem('ranked-gym:training') ?? '{}') as {
      routines?: Array<{ id?: string; exercises?: Array<{ canonicalExerciseId?: string }> }>
      activeWorkoutDraft?: { routineId?: string } | null
    }
    expect(stored.activeWorkoutDraft).toBeTruthy()
    const live = stored.routines?.find((r) => r.id === stored.activeWorkoutDraft?.routineId)
    expect(live?.exercises?.filter((ex) => ex.canonicalExerciseId === 'bench_press').length).toBe(1)
    await cleanup()
  })

  it('séance active → Ajouter une seule fois, anti-doublon', async () => {
    seedHub('bench')
    const raw = JSON.parse(localStorage.getItem('ranked-gym:training') ?? '{}') as Record<string, unknown>
    localStorage.setItem(
      'ranked-gym:training',
      JSON.stringify({
        ...raw,
        lastSelectedRoutineId: 'upper',
        lastSelectedSportId: 'musculation',
        routines: [
          {
            id: 'upper',
            label: 'Upper',
            subtitle: '',
            accent: '#FF2B2B',
            updatedAt: NOW,
            exercises: [
              {
                id: 'ex-row',
                name: 'Row barre',
                canonicalExerciseId: 'barbell_row',
                sets: [{ reps: 0, weightKg: 0 }],
              },
            ],
          },
        ],
        activeWorkoutDraft: {
          routineId: 'upper',
          sportId: 'musculation',
          startedAt: NOW - 45_000,
          updatedAt: NOW,
          elapsedActiveMs: 40_000,
          runningSince: NOW - 5_000,
          paused: false,
          activeExerciseIndex: 0,
          restTimer: null,
        },
      }),
    )
    const { host, cleanup } = await renderHub()
    expect(host.textContent).toContain('Ajouter à ma séance')
    expect(host.textContent).not.toContain('Tu pourras compléter ta séance ensuite')
    const add = [...host.querySelectorAll('button')].find((el) =>
      el.textContent?.includes('Ajouter à ma séance'),
    )
    await act(async () => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const read = () =>
      JSON.parse(localStorage.getItem('ranked-gym:training') ?? '{}') as {
        routines?: Array<{
          id?: string
          exercises?: Array<{ canonicalExerciseId?: string }>
        }>
        activeWorkoutDraft?: { routineId?: string } | null
      }
    const live = () =>
      read().routines?.find((r) => r.id === read().activeWorkoutDraft?.routineId)?.exercises ?? []
    expect(live().filter((ex) => ex.canonicalExerciseId === 'bench_press').length).toBe(1)
    appendExerciseToActiveRoutine({
      id: 'ex-dup',
      name: 'Développé couché',
      canonicalExerciseId: 'bench_press',
      sets: [{ reps: 0, weightKg: 0 }],
    })
    expect(live().filter((ex) => ex.canonicalExerciseId === 'bench_press').length).toBe(1)
    await cleanup()
  })

  it('Pas pour moi retire la reco affichée', async () => {
    seedHub('bench')
    const { host, cleanup } = await renderHub()
    const dismiss = [...host.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'Pas pour moi')
    await act(async () => {
      dismiss?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-canonical-exercise="bench_press"]')).toBeNull()
    expect(host.querySelectorAll('[data-training-reco]').length).toBeLessThanOrEqual(1)
    await cleanup()
  })

  it('openActivitySheet sans brouillon ouvre Nouvelle séance', async () => {
    seedHub('bench')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const value = buildAuthContextValue({ isAuthenticated: false, isLoading: false })
    await act(async () => {
      root.render(
        <AuthStateProvider value={value}>
          <RestTimerProvider>
            <TrainingView openActivitySheet />
          </RestTimerProvider>
        </AuthStateProvider>,
      )
    })
    expect(document.querySelector('[data-new-session-sheet]')).toBeTruthy()
    const sheet = document.querySelector('[data-new-session-sheet]')
    expect(sheet?.textContent).toContain('Musculation')
    expect(sheet?.textContent).toContain('Course')
    expect(sheet?.textContent).toContain('Football')
    expect(sheet?.textContent).toContain('Autre activité')
    await act(async () => root.unmount())
    host.remove()
  })
})
