/**
 * QA fixture — hub Train amélioré @ 390×844.
 * Route: /train-hub-fixture?scene=empty|goal|spark|spark-slow|rest|beginner|beginner-open
 *
 * empty: real TrainingView (start card = same ▶ path → Nouvelle séance → carnet).
 */
import { useEffect, useMemo, useState } from 'react'
import { BrandMark } from '../components/brand/BrandMark'
import { TrainStartSessionCard } from '../components/training/TrainStartSessionCard'
import { TrainWeeklyGoalCard } from '../components/training/TrainWeeklyGoalCard'
import { TrainRestReminderCard } from '../components/training/TrainRestReminderCard'
import { TrainBeginnerProgrammeCard } from '../components/training/TrainBeginnerProgrammeCard'
import { TrainBeginnerSessionView } from '../components/training/TrainBeginnerSessionView'
import { TrainGymLeaderboardCard } from '../components/training/TrainGymLeaderboardCard'
import { TrainWeekStrip } from '../components/training/TrainWeekStrip'
import { TrainActivitySheet, type QuickActivityId } from '../components/training/TrainActivitySheet'
import { TrainingView } from '../components/training/TrainingView'
import { AuthStateProvider } from '../context/AuthContext'
import { RestTimerProvider } from '../context/RestTimerContext'
import {
  ensureBeginnerProgrammeRoutine,
  getTrainingState,
  saveTrainingState,
  setWeeklySessionGoal,
  markWeeklyGoalSparkShown,
  setRestReminderPrefs,
  startFreeWorkoutSession,
  ensureActiveWorkoutClock,
} from '../services/trainingStorage'
import { saveCalorieProfile, getCalorieProfile } from '../services/nutritionStorage'
import { BEGINNER_PROGRAMME_ID } from '../data/beginnerProgramme'
import { buildBeginnerRoutine } from '../services/beginnerProgramme'
import { resolveTrainStartSessionAction } from '../services/trainStartSession'
import { deriveWeekStrip } from '../utils/trainHub'
import { parisDateKey, shiftDateKey } from '../utils/parisDate'
import {
  dismissRestReminderForCurrentWeek,
  shouldShowRestReminder,
} from '../services/trainRestReminder'
import {
  parseWeeklySessionGoal,
  resolveWeeklySessionGoal,
  type WeeklySessionGoalTarget,
} from '../services/trainWeeklyGoal'
import { WEEKLY_GOAL_SPARK_MS } from '../components/training/trainWeeklyGoalMotion'
import { countSessionsInParisWeek } from '../services/trainWeekProgress'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../test/authFixtureValue'
import type { WorkoutNote } from '../types/training'

function sceneFromQuery(): string {
  try {
    return new URLSearchParams(window.location.search).get('scene') ?? 'empty'
  } catch {
    return 'empty'
  }
}

function seedAdultProfile() {
  const cur = getCalorieProfile()
  saveCalorieProfile(
    {
      ...cur,
      age: 28,
      sex: 'female',
      healthAnswer: 'none',
      declaredPregnancy: false,
      declaredBreastfeeding: false,
      declaredEatingDisorder: false,
      onboardingComplete: true,
    },
    { skipCloud: true },
  )
}

function noteOn(dateKey: string, id: string): WorkoutNote {
  return {
    id,
    title: 'Séance',
    dateKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    estimatedKcal: 0,
    exercises: [
      { id: `ex-${id}`, name: 'Presse à cuisses', sets: [{ reps: 10, weightKg: 40 }] },
    ],
  }
}

function seedScene(scene: string) {
  seedAdultProfile()
  const today = parisDateKey()
  const yesterday = shiftDateKey(today, -1)
  let notes: WorkoutNote[] = []
  if (scene === 'spark' || scene === 'spark-slow') {
    // Start at 1/2 — capture bumps to 2/2 so fill + spark are visible
    notes = [noteOn(today, 'n-today')]
  }
  if (scene === 'rest') {
    notes = [noteOn(yesterday, 'n-y'), noteOn(today, 'n-t')]
  }
  if (
    scene === 'beginner' ||
    scene === 'beginner-open' ||
    scene === 'gainage' ||
    scene === 'goal' ||
    scene === 'empty'
  ) {
    notes = []
  }
  const state = getTrainingState()
  saveTrainingState(
    {
      ...state,
      workoutNotes: notes,
      activeWorkoutDraft: null,
      weeklySessionGoal: {
        target: 2,
        updatedAt: Date.now(),
        sparkShownWeekKey: null,
      },
      restReminder: { enabled: true, updatedAt: Date.now(), dismissedWeekKey: null },
      routines: [...state.routines.filter((r) => r.id !== BEGINNER_PROGRAMME_ID), buildBeginnerRoutine()],
      sportsOnboardingComplete: true,
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
    },
    { skipCloud: true },
  )
}

const authValue = buildAuthContextValue({
  isAuthenticated: true,
  isLoading: false,
  user: FIXTURE_AUTH_USER,
  requireAuth: (onSuccess) => {
    onSuccess?.()
  },
})

/** empty scene — real TrainingView so ▶ and start card share one path. */
function EmptyTrainHubLive() {
  // Seed synchronously before TrainingView reads localStorage.
  useMemo(() => {
    seedScene('empty')
    return true
  }, [])
  return (
    <AuthStateProvider value={authValue}>
      <RestTimerProvider>
        <div data-train-hub-fixture="1" data-scene="empty" className="h-[100dvh] mesh-bg">
          <TrainingView />
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

export function TrainHubFixture() {
  const scene = useMemo(() => sceneFromQuery(), [])
  if (scene === 'empty') return <EmptyTrainHubLive />
  return <TrainHubCardsFixture scene={scene} />
}

function TrainHubCardsFixture({ scene }: { scene: string }) {
  const [tick, setTick] = useState(0)
  const [programmeOpen, setProgrammeOpen] = useState(scene === 'beginner-open')
  const [activityOpen, setActivityOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [sparkSlow, setSparkSlow] = useState(scene === 'spark-slow')
  const [doneOverride, setDoneOverride] = useState<number | null>(null)

  useEffect(() => {
    seedScene(scene)
    setTick((n) => n + 1)
  }, [scene])

  // spark / spark-slow: hold 1/2, then reach 2/2 so bar fill + spark run
  useEffect(() => {
    if (scene !== 'spark' && scene !== 'spark-slow') return
    setDoneOverride(1)
    const t = window.setTimeout(() => {
      const today = parisDateKey()
      const state = getTrainingState()
      saveTrainingState(
        {
          ...state,
          workoutNotes: [
            noteOn(today, 'n-today'),
            noteOn(today, 'n-today-2'),
          ],
          weeklySessionGoal: {
            target: 2,
            updatedAt: Date.now(),
            sparkShownWeekKey: null,
          },
        },
        { skipCloud: true },
      )
      setDoneOverride(2)
      setTick((n) => n + 1)
    }, 900)
    return () => window.clearTimeout(t)
  }, [scene])

  const state = useMemo(() => getTrainingState(), [tick])
  const now = useMemo(() => new Date(), [tick])
  const weekStrip = deriveWeekStrip(state.workoutNotes, now)
  const weekCount =
    doneOverride != null ? doneOverride : countSessionsInParisWeek(state.workoutNotes, now)
  const weeklyGoal = parseWeeklySessionGoal(state.weeklySessionGoal)
  const showRest = shouldShowRestReminder(state.workoutNotes, state.restReminder, now)
  const startLikePlayButton = () => {
    const draft = getTrainingState().activeWorkoutDraft
    const action = resolveTrainStartSessionAction(Boolean(draft))
    if (action === 'resume-draft' && draft) {
      ensureActiveWorkoutClock()
      setSessionOpen(true)
      setTick((n) => n + 1)
      return
    }
    setActivityOpen(true)
  }

  const onQuickActivity = (id: QuickActivityId) => {
    if (id === 'musculation') {
      ensureBeginnerProgrammeRoutine()
      startFreeWorkoutSession('musculation')
      setSessionOpen(true)
      setTick((n) => n + 1)
    }
    setActivityOpen(false)
  }

  if (programmeOpen || scene === 'beginner-open') {
    return (
      <div
        className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans"
        data-train-hub-fixture="1"
        data-scene={scene}
      >
        <header className="border-b border-white/5 bg-[#0C0C0E]">
          <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-2">
            <BrandMark variant="compact" />
          </div>
        </header>
        <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">
          <TrainBeginnerSessionView
            machineBusyIds={['leg_press']}
            onClose={scene === 'beginner-open' ? undefined : () => setProgrammeOpen(false)}
          />
        </main>
      </div>
    )
  }

  if (sessionOpen) {
    // Non-empty fixture scenes that start a free session — mirror empty TrainingView outcome.
    return (
      <AuthStateProvider value={authValue}>
        <RestTimerProvider>
          <div
            className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans"
            data-train-hub-fixture="1"
            data-scene={scene}
            data-testid="train-hub-session-open"
            data-session-open="1"
          >
            <TrainingView
              launchRoutineId={getTrainingState().activeWorkoutDraft?.routineId ?? null}
              resumeActiveWorkout
            />
          </div>
        </RestTimerProvider>
      </AuthStateProvider>
    )
  }

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans"
      data-train-hub-fixture="1"
      data-scene={scene}
    >
      <header className="border-b border-white/5 bg-[#0C0C0E]">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-2">
          <BrandMark variant="compact" />
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">
        <h1 className="text-[34px] font-bold tracking-tight text-white">Train</h1>
        <TrainWeekStrip days={weekStrip} />

        <TrainStartSessionCard
          onStart={startLikePlayButton}
          resume={Boolean(state.activeWorkoutDraft)}
        />

        <TrainWeeklyGoalCard
          doneCount={weekCount}
          target={resolveWeeklySessionGoal(weeklyGoal) as WeeklySessionGoalTarget}
          sparkShownWeekKey={weeklyGoal.sparkShownWeekKey}
          sparkDurationMs={
            sparkSlow || scene === 'spark-slow' ? WEEKLY_GOAL_SPARK_MS * 4 : undefined
          }
          onChangeTarget={(next) => {
            setWeeklySessionGoal(next)
            setTick((n) => n + 1)
          }}
          onSparkShown={(weekKey) => {
            markWeeklyGoalSparkShown(weekKey)
            setTick((n) => n + 1)
            if (scene === 'spark' && !sparkSlow) {
              // After normal spark, prepare a slow-mo remount pass for the video
              window.setTimeout(() => {
                const st = getTrainingState()
                saveTrainingState(
                  {
                    ...st,
                    weeklySessionGoal: {
                      target: 2,
                      updatedAt: Date.now(),
                      sparkShownWeekKey: null,
                    },
                  },
                  { skipCloud: true },
                )
                setSparkSlow(true)
                setTick((n) => n + 1)
              }, WEEKLY_GOAL_SPARK_MS + 200)
            }
          }}
        />

        {showRest ? (
          <TrainRestReminderCard
            onDismiss={() => {
              setRestReminderPrefs(dismissRestReminderForCurrentWeek(state.restReminder))
              setTick((n) => n + 1)
            }}
          />
        ) : null}

        <TrainGymLeaderboardCard />

        <TrainBeginnerProgrammeCard
          onStart={() => {
            ensureBeginnerProgrammeRoutine()
            startFreeWorkoutSession('musculation', BEGINNER_PROGRAMME_ID)
            setProgrammeOpen(true)
            setTick((n) => n + 1)
          }}
        />
      </main>

      <TrainActivitySheet
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        onSelect={onQuickActivity}
      />
    </div>
  )
}
