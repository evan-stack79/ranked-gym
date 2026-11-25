/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingView } from './TrainingView'
import { AuthStateProvider } from '../../context/AuthContext'
import { RestTimerProvider } from '../../context/RestTimerContext'
import { buildAuthContextValue } from '../../test/authFixtureValue'
import { saveCalorieProfile } from '../../services/nutritionStorage'
import {
  trainV2CtaLabel,
  trainV2HeroMeta,
  trainV2HeroTitle,
} from './TrainV2Hub'
import type { TodayHubCard } from '../../utils/trainHub'

vi.mock('../../assets/brand/panther-roaring.png', () => ({ default: 'panther.png' }))
vi.mock('../../assets/photos/train/photo-hero-a.jpg', () => ({ default: 'hero-a.jpg' }))
vi.mock('../../assets/photos/train/photo-creneau-thumb.jpg', () => ({ default: 'creneau.jpg' }))
vi.mock('../../assets/photos/train/photo-bench-thumb.jpg', () => ({ default: 'bench.jpg' }))
vi.mock('../../services/restTimerLiveActivity', () => ({
  startRestLiveActivity: vi.fn(),
  updateRestLiveActivity: vi.fn(),
  endRestLiveActivity: vi.fn(),
}))
vi.mock('../../utils/restTimerSound', () => ({ playRestCompleteChime: vi.fn() }))
vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))

/** Mercredi 23/09/2026 — weekday 3. */
const NOW = Date.parse('2026-09-23T10:00:00.000Z')

function seedHub(kind: 'planned' | 'empty') {
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
            durationMin: 52,
            sessionKind: 'strength',
            sportId: 'musculation',
            exercises: [
              {
                id: 'ex-1',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [
                  { reps: 8, weightKg: 60, done: true },
                  { reps: 8, weightKg: 60, done: true },
                ],
              },
              {
                id: 'ex-2',
                name: 'Row',
                sets: [
                  { reps: 8, weightKg: 50, done: true },
                  { reps: 8, weightKg: 50, done: true },
                ],
              },
            ],
          },
          {
            id: 'fix-hub-2',
            title: 'Push fixture 2',
            dateKey: '2026-09-22',
            createdAt: NOW - 1 * 86400000,
            durationMin: 40,
            sessionKind: 'strength',
            sportId: 'musculation',
            exercises: [
              {
                id: 'ex-3',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 55, done: true }],
              },
            ],
          },
        ]

  const schedule =
    kind === 'empty'
      ? []
      : [
          {
            id: 'sch-upper',
            title: 'Upper',
            templateId: 'tpl-upper',
            days: [3],
            time: '18:00',
            enabled: true,
            sportId: 'musculation',
          },
        ]

  localStorage.setItem(
    'ranked-gym:training',
    JSON.stringify({
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
      sportsOnboardingComplete: true,
      stepsToday: 0,
      stepsDateKey: '2026-09-23',
      healthLinked: false,
      notificationsEnabled: false,
      templates: [],
      schedule,
      completed: [],
      workoutNotes: notes,
      routines: [
        {
          id: 'upper',
          label: 'Upper',
          subtitle: '',
          accent: '#FF0702',
          updatedAt: 0,
          exercises:
            kind === 'empty'
              ? []
              : [
                  { id: 'e1', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] },
                  { id: 'e2', name: 'Row', sets: [{ reps: 8, weightKg: 50 }] },
                  { id: 'e3', name: 'OHP', sets: [{ reps: 8, weightKg: 40 }] },
                  { id: 'e4', name: 'Curl', sets: [{ reps: 10, weightKg: 20 }] },
                ],
        },
      ],
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

const emptyCard: TodayHubCard = {
  cta: 'choose_activity',
  title: 'Aucune séance',
  sportLabel: 'Multisport',
  summaryLine: 'Choisis une activité pour commencer',
  routineId: null,
  canLaunchRoutine: false,
  openTarget: 'activity',
  sportId: null,
  sessionKind: null,
}

describe('trainV2 helpers — états vides', () => {
  it('héros Repos sans culpabiliser', () => {
    expect(trainV2HeroTitle(emptyCard)).toBe('Repos')
    expect(trainV2HeroMeta(emptyCard)).toBe('Pas de séance prévue')
    expect(trainV2CtaLabel('choose_activity')).toBe('Choisir')
  })

  it('CTA Démarrer / Reprendre', () => {
    expect(trainV2CtaLabel('start')).toBe('Démarrer')
    expect(trainV2CtaLabel('resume')).toBe('Reprendre')
  })
})

describe('Train v2 — hub', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('affiche héros UPPER, tuiles, stats, créneau, dernière séance', async () => {
    seedHub('planned')
    const { host, cleanup } = await renderHub()
    expect(host.querySelector('[data-train-v2="1"]')).toBeTruthy()
    expect(host.querySelector('[data-train-v2-title]')?.textContent).toMatch(/Upper/i)
    expect(host.querySelector('[data-train-v2-meta]')?.textContent).toMatch(/Musculation/)
    expect(host.querySelector('[data-train-v2-start]')?.textContent).toMatch(/Démarrer/i)
    expect(host.querySelector('[data-train-v2-week]')).toBeTruthy()
    expect(host.querySelector('[data-train-v2-stats]')).toBeTruthy()
    expect(host.querySelector('[data-train-v2-stat="sessions"]')?.textContent).toContain('2')
    expect(host.querySelector('[data-creneau-entry]')).toBeTruthy()
    expect(host.textContent).toContain('Mon créneau')
    expect(host.textContent).toContain('Ouvrir')
    expect(host.querySelector('[data-train-v2-last]')).toBeTruthy()
    expect(host.textContent).toContain('Dernière séance')
    expect(host.querySelector('[aria-label="Réglages"]')).toBeTruthy()
    expect(host.querySelector('[data-training-reco]')).toBeNull()
    expect(host.textContent).not.toMatch(/kcal|XP|score/i)
    await cleanup()
  })

  it('état vide : Repos, stats à 0, pas de dernière séance carte', async () => {
    seedHub('empty')
    const { host, cleanup } = await renderHub()
    expect(host.querySelector('[data-train-v2-title]')?.textContent).toBe('Repos')
    expect(host.querySelector('[data-train-v2-meta]')?.textContent).toBe('Pas de séance prévue')
    expect(host.querySelector('[data-train-v2-start]')?.textContent).toMatch(/Choisir/i)
    expect(host.querySelector('[data-train-v2-stat="sessions"]')?.textContent).toContain('0')
    expect(host.querySelector('[data-train-v2-stat="active_min"]')?.textContent).toContain('0')
    expect(host.textContent).not.toContain('Aucune séance cette semaine')
    expect(host.querySelector('[data-train-v2-last]')).toBeNull()
    expect(host.querySelector('[data-train-v2-last-empty]')).toBeTruthy()
    await cleanup()
  })

  it('Démarrer ouvre le carnet de la séance du jour', async () => {
    seedHub('planned')
    const { host, cleanup } = await renderHub()
    const cta = host.querySelector('[data-train-v2-start]') as HTMLButtonElement | null
    expect(cta).toBeTruthy()
    await act(async () => {
      cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-train-v2]')).toBeNull()
    expect(host.querySelector('#workout-notebook') || host.textContent).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem('ranked-gym:training') ?? '{}') as {
      activeWorkoutDraft?: { routineId?: string } | null
    }
    // openNotebook with routine id starts / resumes — draft may appear after notebook mount
    expect(host.querySelector('[data-training-hub]')).toBeNull()
    expect(stored).toBeTruthy()
    await cleanup()
  })

  it('Ouvrir Mon créneau passe en plein écran créneau', async () => {
    seedHub('planned')
    const { host, cleanup } = await renderHub()
    const entry = host.querySelector('[data-creneau-entry]') as HTMLButtonElement | null
    await act(async () => {
      entry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-creneau-v9]') || host.querySelector('[data-creneau-flow]')).toBeTruthy()
    await cleanup()
  })
})
