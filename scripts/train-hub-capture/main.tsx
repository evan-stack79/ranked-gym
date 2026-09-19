import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { TrainingView } from '../../src/components/training/TrainingView'
import { AuthStateProvider } from '../../src/context/AuthContext'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import type { TrainingState, WorkoutNote } from '../../src/types/training'
import type { TabId } from '../../src/types'

/** Horloge figée — le harness ne dépend jamais de la date réelle. */
const FIXED_ISO = '2026-09-04T15:00:00.000'
const FIXED_MS = new Date(FIXED_ISO).getTime()
const TODAY = '2026-09-04'
const WEEKDAY = 5 // vendredi 2026-09-04

const RealDate = Date

class HarnessDate extends RealDate {
  constructor(...args: ConstructorParameters<typeof Date>) {
    if (args.length === 0) {
      super(FIXED_MS)
      return
    }
    // @ts-expect-error — forward Date constructor overloads
    super(...args)
  }

  static now() {
    return FIXED_MS
  }

  static parse = RealDate.parse
  static UTC = RealDate.UTC
}

// @ts-expect-error — remplacer Date globale pour le harness
globalThis.Date = HarnessDate

function seedState(scenario: string): TrainingState {
  const pushRoutine = {
    id: 'push',
    label: 'Push',
    subtitle: 'Pecs · Épaules',
    accent: '#FF2B2B',
    exercises: [
      {
        id: 'ex-bench',
        name: 'Développé couché',
        sets: [
          { reps: 8, weightKg: 60, done: scenario === 'resume',
            ...(scenario === 'resume' ? { restSec: 83, difficulty: 'hard' as const, rpe: 9 } : {}) },
          { reps: 8, weightKg: 60 },
        ],
      },
      {
        id: 'ex-ohp',
        name: 'Développé militaire',
        sets: [{ reps: 10, weightKg: 40 }],
      },
    ],
    updatedAt: FIXED_MS,
  }

  const historyFilled: WorkoutNote[] = [
    {
      id: 'n1',
      title: 'Push',
      routineId: 'push',
      dateKey: '2026-09-02',
      createdAt: new RealDate('2026-09-02T18:00:00').getTime(),
      estimatedKcal: 280,
      durationMin: 48,
      sessionKind: 'strength',
      sportId: 'musculation',
      exercises: [
        {
          id: 'e1',
          name: 'Développé couché',
          sets: [
            { reps: 3, weightKg: 100, done: true, restSec: 180, difficulty: 'easy', rpe: 5 },
          ],
        },
      ],
    },
    {
      id: 'n2',
      title: 'Course',
      dateKey: '2026-09-03',
      createdAt: new RealDate('2026-09-03T08:00:00').getTime(),
      estimatedKcal: 320,
      durationMin: 32,
      sessionKind: 'endurance',
      sportId: 'course-a-pied',
      details: { kind: 'endurance', distanceKm: 5.2 },
      exercises: [{ id: 'e2', name: '5,2 km', sets: [{ reps: 32, weightKg: 0 }] }],
    },
  ]

  const base: TrainingState = {
    primarySportId: 'musculation',
    favoriteSportIds: ['musculation'],
    stepsToday: 4200,
    stepsDateKey: TODAY,
    healthLinked: false,
    notificationsEnabled: false,
    templates: [],
    schedule: [],
    completed: [],
    workoutNotes: scenario === 'empty' || scenario === 'invalid' ? [] : historyFilled,
    routines: [pushRoutine],
    lastSelectedRoutineId: scenario === 'resume' ? 'push' : null,
    lastSelectedSportId: scenario === 'resume' ? 'musculation' : null,
    lastVoluntaryRoute:
      scenario === 'resume' || scenario === 'rest-timer' ? 'train-hub' : null,
    activeWorkoutDraft: scenario === 'resume' || scenario === 'rest-timer'
      ? {
          routineId: 'push',
          sportId: 'musculation',
          startedAt: FIXED_MS - 60_000,
          updatedAt: FIXED_MS,
          elapsedActiveMs: 45_000,
          runningSince: scenario === 'rest-timer' ? FIXED_MS - 15_000 : null,
          paused: scenario !== 'rest-timer',
          activeExerciseIndex: scenario === 'resume' ? 0 : undefined,
          restTimer:
            scenario === 'rest-timer'
              ? {
                  totalSec: 90,
                  remainingSec: 55,
                  endsAt: FIXED_MS + 55_000,
                  paused: false,
                  target: {
                    exerciseId: 'ex-bench',
                    setIndex: 0,
                    exerciseName: 'Développé couché',
                    setLabel: 'Série 1',
                  },
                }
              : null,
        }
      : null,
  }

  if (scenario === 'strength' || scenario === 'resume' || scenario === 'rest-timer') {
    return {
      ...base,
      schedule: [
        {
          id: 'sch-1',
          templateId: 'push',
          title: 'Push',
          days: [WEEKDAY],
          time: '18:30',
          enabled: true,
          sportId: 'musculation',
          sessionKind: 'strength',
        },
      ],
    }
  }

  if (scenario === 'endurance' || scenario === 'course') {
    return {
      ...base,
      primarySportId: 'course-a-pied',
      schedule: [
        {
          id: 'sch-run',
          templateId: 'notebook',
          title: 'Sortie course',
          days: [WEEKDAY],
          time: '07:30',
          enabled: true,
          sportId: 'course-a-pied',
          sessionKind: 'endurance',
        },
      ],
    }
  }

  if (scenario === 'football' || scenario === 'football-match') {
    return {
      ...base,
      primarySportId: 'football',
      schedule: [{
        id: 'sch-foot-match', templateId: 'notebook', title: 'Match de football',
        days: [WEEKDAY], time: '20:00', enabled: true, sportId: 'football', sessionKind: 'team',
      }],
      workoutNotes: [
        ...historyFilled,
        {
          id: 'n3',
          title: 'Football',
          dateKey: TODAY,
          createdAt: FIXED_MS,
          estimatedKcal: 500,
          durationMin: 90,
          sessionKind: 'team',
          sportId: 'football',
          details: { kind: 'team', sessionType: 'match', position: 'ailier' },
          exercises: [{ id: 'e3', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
        },
      ],
    }
  }

  if (scenario === 'football-training') {
    return {
      ...base,
      primarySportId: 'football',
      schedule: [{
        id: 'sch-foot-training', templateId: 'notebook', title: 'Entraînement football',
        days: [WEEKDAY], time: '19:00', enabled: true, sportId: 'football', sessionKind: 'team',
      }],
      workoutNotes: [
        ...historyFilled,
        {
          id: 'n3t',
          title: 'Football',
          dateKey: TODAY,
          createdAt: FIXED_MS,
          estimatedKcal: 400,
          durationMin: 75,
          sessionKind: 'team',
          sportId: 'football',
          details: { kind: 'team', sessionType: 'training' },
          exercises: [{ id: 'e3', name: 'Football', sets: [{ reps: 75, weightKg: 0 }] }],
        },
      ],
    }
  }

  if (scenario === 'other') {
    return {
      ...base,
      primarySportId: 'yoga',
      schedule: [{
        id: 'sch-yoga', templateId: 'notebook', title: 'Yoga du soir', days: [WEEKDAY],
        time: '18:00', enabled: true, sportId: 'yoga', sessionKind: 'generic',
      }],
      workoutNotes: [
        {
          id: 'n4',
          title: 'Yoga',
          dateKey: TODAY,
          createdAt: FIXED_MS,
          estimatedKcal: 180,
          durationMin: 40,
          sessionKind: 'generic',
          sportId: 'yoga',
          exercises: [
            {
              id: 'e4',
              name: 'Yoga',
              sets: [{ reps: 40, weightKg: 0, difficulty: 'easy' }],
            },
          ],
        },
      ],
    }
  }

  if (scenario === 'invalid') {
    return {
      ...base,
      schedule: [
        {
          id: 'sch-bad',
          templateId: 'push',
          title: 'Push manquant',
          days: [WEEKDAY],
          time: '18:00',
          enabled: true,
        },
      ],
      routines: [
        {
          id: 'push',
          label: 'Push',
          subtitle: '',
          accent: '#FF2B2B',
          exercises: [],
          updatedAt: FIXED_MS,
        },
      ],
      workoutNotes: [],
    }
  }

  // empty / default
  return base
}

const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'strength'
const keepStorage = new URLSearchParams(window.location.search).has('keepStorage')

/** Profil Nutri réaliste — évite 0 kg / kcal fictives dans les parcours Train. */
const REALISTIC_PROFILE = {
  weightKg: 78,
  goalWeightKg: 76,
  heightCm: 180,
  age: 28,
  sex: 'male' as const,
  activity: 'active' as const,
  morphology: 'mesomorph' as const,
  goal: 'maintain' as const,
  weeklyPaceKg: 0.5,
  onboardingComplete: true,
}

if (!keepStorage || !localStorage.getItem('ranked-gym:nutrition-profile')) {
  localStorage.setItem('ranked-gym:nutrition-profile', JSON.stringify(REALISTIC_PROFILE))
}
if (!keepStorage || !localStorage.getItem('ranked-gym:training')) {
  localStorage.setItem('ranked-gym:training', JSON.stringify(seedState(scenario)))
}
if (!keepStorage || !localStorage.getItem('ranked-gym:discipline')) {
  if (scenario === 'endurance' || scenario === 'course') {
    localStorage.setItem('ranked-gym:discipline', 'course')
  } else if (
    scenario === 'football' ||
    scenario === 'football-match' ||
    scenario === 'football-training'
  ) {
    localStorage.setItem('ranked-gym:discipline', 'football')
  } else if (scenario === 'other') {
    localStorage.setItem('ranked-gym:discipline', 'fitness')
  } else {
    localStorage.setItem('ranked-gym:discipline', 'musculation')
  }
}

function CaptureApp() {
  const [tab, setTab] = useState<TabId>('training')
  const authValue = useMemo(
    () => ({
      user: null,
      profile: {
        id: 'harness-local',
        pseudo: 'Alex',
        current_streak: 4,
        last_login_date: TODAY,
        discipline: 'musculation',
      },
      isAuthenticated: false,
      isLoading: false,
      isAuthOpen: false,
      authLoading: false,
      authError: null,
      streakWeekBonus: null,
      clearStreakWeekBonus: () => undefined,
      streakCelebration: null,
      clearStreakCelebration: () => undefined,
      refreshProfile: async () => undefined,
      patchProfile: () => undefined,
      openAuth: () => undefined,
      closeAuth: () => undefined,
      requireAuth: () => undefined,
      signInWithEmail: async () => undefined,
      signUpWithEmail: async () => undefined,
      clearAuthMessages: () => undefined,
      requestPasswordReset: async () => undefined,
      confirmPasswordRecovery: async () => undefined,
      updateDiscipline: async () => undefined,
      updateGhostMode: async () => undefined,
      signOut: async () => undefined,
    }),
    [],
  )

  return (
    <AuthStateProvider value={authValue as never}>
      <RestTimerProvider>
        <AppLayout activeTab={tab} onTabChange={setTab}>
          <div data-harness-ready data-scenario={scenario} data-fixed-now={FIXED_ISO}>
            {tab === 'training' ? <TrainingView /> : <p data-other-tab>Autre onglet (témoin de style)</p>}
          </div>
        </AppLayout>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureApp />
  </StrictMode>,
)
