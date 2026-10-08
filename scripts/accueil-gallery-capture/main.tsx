import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { HomeView } from '../../src/components/home/HomeView'
import { TrainingView } from '../../src/components/training/TrainingView'
import { NutritionView } from '../../src/components/nutrition/NutritionView'
import { ProfileView } from '../../src/components/profile/ProfileView'
import { AuthStateProvider } from '../../src/context/AuthContext'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../../src/test/authFixtureValue'
import type { TabId } from '../../src/types'
import type { TrainingState, WorkoutNote, WorkoutRoutine } from '../../src/types/training'
import { todayKey } from '../../src/utils/calories'
import {
  addWaterEntryForDate,
  saveCalorieProfile,
} from '../../src/services/nutritionStorage'
import {
  ACCUEIL_WIDGET_PREFS_KEY,
  createDefaultAccueilWidgetPrefs,
} from '../../src/utils/accueilWidgetPrefs'

const FIXED_ISO = '2026-10-07T18:30:00.000'
const FIXED_MS = new Date(FIXED_ISO).getTime()
const TODAY = '2026-10-07'
const WEEKDAY = 3 // mercredi 2026-10-07

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

// @ts-expect-error — fixed clock for deterministic screenshots
globalThis.Date = HarnessDate

function dateKeyOffset(daysAgo: number): string {
  const date = new RealDate(FIXED_MS)
  date.setDate(date.getDate() - daysAgo)
  return todayKey(date)
}

function atHour(daysAgo: number, hour: number, minute = 0): number {
  const date = new RealDate(FIXED_MS)
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const routines: WorkoutRoutine[] = [
  {
    id: 'push',
    label: 'Push',
    subtitle: 'Poussée',
    accent: '#FF2B2B',
    updatedAt: FIXED_MS,
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 8, weightKg: 60, done: true },
          { reps: 8, weightKg: 60, done: true },
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
      },
      {
        id: 'e2',
        name: 'Développé militaire',
        sets: [
          { reps: 10, weightKg: 30 },
          { reps: 10, weightKg: 30 },
        ],
      },
    ],
  },
  {
    id: 'pull',
    label: 'Pull',
    subtitle: 'Tirage',
    accent: '#00B4FF',
    updatedAt: FIXED_MS,
    exercises: [
      {
        id: 'e3',
        name: 'Tractions',
        canonicalExerciseId: 'pull_up',
        sets: [{ reps: 6, weightKg: 0 }, { reps: 6, weightKg: 0 }],
      },
      {
        id: 'e3b',
        name: 'Rowing barre',
        canonicalExerciseId: 'barbell_row',
        sets: [{ reps: 8, weightKg: 50 }, { reps: 8, weightKg: 50 }],
      },
    ],
  },
  {
    id: 'legs',
    label: 'Legs',
    subtitle: 'Jambes',
    accent: '#FF9F0A',
    updatedAt: FIXED_MS,
    exercises: [
      {
        id: 'e4',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }],
      },
      {
        id: 'e4b',
        name: 'Soulevé de terre',
        canonicalExerciseId: 'deadlift',
        sets: [{ reps: 5, weightKg: 120 }, { reps: 5, weightKg: 120 }],
      },
    ],
  },
  {
    id: 'full',
    label: 'Full',
    subtitle: 'Full body',
    accent: '#FF2B2B',
    updatedAt: FIXED_MS,
    exercises: [
      {
        id: 'e6',
        name: 'Développé couché haltères',
        canonicalExerciseId: 'dumbbell_bench_press',
        sets: [{ reps: 10, weightKg: 28 }, { reps: 10, weightKg: 28 }],
      },
    ],
  },
]

const notes: WorkoutNote[] = [
  {
    id: 'n-yest',
    title: 'Squat',
    dateKey: dateKeyOffset(1),
    createdAt: atHour(1, 17, 10),
    estimatedKcal: 280,
    durationMin: 40,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e4',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }],
      },
    ],
  },
  {
    id: 'n-bench',
    title: 'Développé couché',
    dateKey: dateKeyOffset(2),
    createdAt: atHour(2, 18, 30),
    estimatedKcal: 220,
    durationMin: 28,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }],
      },
    ],
  },
  {
    id: 'n-pull',
    title: 'Tractions',
    dateKey: dateKeyOffset(3),
    createdAt: atHour(3, 12, 0),
    estimatedKcal: 180,
    durationMin: 25,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e3',
        name: 'Tractions',
        canonicalExerciseId: 'pull_up',
        sets: [{ reps: 6, weightKg: 0 }, { reps: 6, weightKg: 0 }],
      },
    ],
  },
  {
    id: 'n-dead',
    title: 'Soulevé de terre',
    dateKey: dateKeyOffset(4),
    createdAt: atHour(4, 18, 20),
    estimatedKcal: 320,
    durationMin: 45,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [
      {
        id: 'e5',
        name: 'Soulevé de terre',
        canonicalExerciseId: 'deadlift',
        sets: [{ reps: 5, weightKg: 120 }, { reps: 5, weightKg: 120 }],
      },
    ],
  },
  {
    id: 'n-older',
    title: 'Push',
    dateKey: dateKeyOffset(5),
    createdAt: atHour(5, 19, 0),
    estimatedKcal: 300,
    durationMin: 42,
    sessionKind: 'strength',
    sportId: 'musculation',
    routineId: 'push',
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 8, weightKg: 60 }],
      },
      {
        id: 'e2',
        name: 'Développé militaire',
        sets: [{ reps: 10, weightKg: 30 }],
      },
    ],
  },
]

const fixtureState: TrainingState = {
  primarySportId: 'musculation',
  favoriteSportIds: ['musculation'],
  stepsToday: 4200,
  stepsDateKey: TODAY,
  healthLinked: false,
  notificationsEnabled: false,
  templates: [],
  schedule: [
    {
      id: 'sch-1',
      templateId: 'tpl-push',
      title: 'Push',
      days: [WEEKDAY],
      time: '18:00',
      enabled: true,
      sportId: 'musculation',
      sessionKind: 'strength',
    },
  ],
  completed: [],
  workoutNotes: notes,
  routines,
  lastSelectedRoutineId: 'push',
  lastSelectedSportId: 'musculation',
  activeWorkoutDraft: {
    routineId: 'push',
    sportId: 'musculation',
    startedAt: FIXED_MS - 20 * 60_000,
    updatedAt: FIXED_MS,
  },
  // Soft-leave hub: keep Train on hub with floating pill visible (no immersive chrome hide).
  lastVoluntaryRoute: 'train-hub',
  sportsOnboardingComplete: true,
}

localStorage.setItem('ranked-gym:training', JSON.stringify(fixtureState))
localStorage.setItem('ranked-gym:discipline', 'musculation')

saveCalorieProfile(
  {
    weightKg: 78,
    goalWeightKg: 76,
    heightCm: 180,
    age: 28,
    sex: 'male',
    activity: 'active',
    morphology: 'mesomorph',
    goal: 'maintain',
    weeklyPaceKg: 0.5,
    onboardingComplete: true,
  },
  { skipCloud: true },
)

// Realistic water journal for Eau tile screenshots (idempotent across reloads).
const waterSeedKey = 'ranked-gym:accueil-capture-water-seeded'
if (localStorage.getItem(waterSeedKey) !== '1') {
  addWaterEntryForDate(TODAY, { amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
  addWaterEntryForDate(TODAY, { amountMl: 700, type: 'bottle', label: 'Bouteille' }, { skipCloud: true })
  localStorage.setItem(waterSeedKey, '1')
}

// Default Accueil prefs only when absent — capture scripts may set waterGoalMl.
if (!localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY)) {
  localStorage.setItem(
    ACCUEIL_WIDGET_PREFS_KEY,
    JSON.stringify(createDefaultAccueilWidgetPrefs(FIXED_MS)),
  )
}

document.documentElement.style.setProperty('--app-safe-area-top', '47px')
document.documentElement.style.setProperty('--app-safe-area-bottom', '34px')
document.documentElement.dataset.bottomNavPreview = 'floating-pill'

function CaptureShell() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialTab = (params.get('tab') as TabId | null) ?? 'home'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const [resumeActive, setResumeActive] = useState(false)
  const [openActivity, setOpenActivity] = useState(false)
  const [openHistory, setOpenHistory] = useState(false)

  const authValue = useMemo(
    () =>
      buildAuthContextValue({
        user: FIXTURE_AUTH_USER,
        profile: {
          id: 'harness-local',
          pseudo: 'Alex',
          level: 4,
          xp: 420,
          rank: 'Silver',
          discipline: 'musculation',
          custom_spots: [],
          active_checkin: null,
          current_streak: 4,
          last_login_date: TODAY,
          avatar_url: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: FIXED_ISO,
        },
        isAuthenticated: true,
        isLoading: false,
      }),
    [],
  )

  const consumeLaunch = () => {
    setLaunchRoutineId(null)
    setResumeActive(false)
    setOpenActivity(false)
    setOpenHistory(false)
  }

  return (
    <AuthStateProvider value={authValue}>
      <RestTimerProvider>
        <div data-harness-ready="1" data-accueil-capture="1" data-fixed-now={FIXED_ISO}>
          <AppLayout
            activeTab={tab}
            onTabChange={(next) => {
              setTab(next)
              setOpenHistory(false)
              setOpenActivity(false)
            }}
            onStartTraining={() => {
              setLaunchRoutineId('push')
              setResumeActive(true)
              setOpenActivity(false)
              setTab('training')
            }}
            hasActiveWorkout
          >
            {tab === 'home' ? (
              <HomeView
                onStartTraining={(id) => {
                  setLaunchRoutineId(id)
                  setResumeActive(true)
                  setTab('training')
                }}
                onOpenTraining={() => {
                  setOpenHistory(false)
                  setTab('training')
                }}
                onOpenNutrition={() => setTab('nutrition')}
                onOpenHistory={() => {
                  setOpenHistory(true)
                  setTab('training')
                }}
              />
            ) : null}
            {tab === 'training' ? (
              <TrainingView
                launchRoutineId={launchRoutineId}
                resumeActiveWorkout={resumeActive}
                onLaunchConsumed={consumeLaunch}
                openActivitySheet={openActivity}
                openHistory={openHistory}
              />
            ) : null}
            {tab === 'nutrition' ? <NutritionView /> : null}
            {tab === 'profile' ? <ProfileView /> : null}
          </AppLayout>
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureShell />
  </StrictMode>,
)
