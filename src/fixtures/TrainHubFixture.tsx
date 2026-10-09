/**
 * QA fixture — hub Train amélioré @ 390×844.
 * Route: /train-hub-fixture?scene=empty|goal|rest|beginner
 */
import { useEffect, useMemo, useState } from 'react'
import { BrandMark } from '../components/brand/BrandMark'
import { TrainStartSessionCard } from '../components/training/TrainStartSessionCard'
import { TrainWeeklyGoalCard } from '../components/training/TrainWeeklyGoalCard'
import { TrainRestReminderCard } from '../components/training/TrainRestReminderCard'
import { TrainBeginnerProgrammeCard } from '../components/training/TrainBeginnerProgrammeCard'
import { TrainGymLeaderboardCard } from '../components/training/TrainGymLeaderboardCard'
import { TrainWeekStrip } from '../components/training/TrainWeekStrip'
import { GainageHoldPanel } from '../components/training/GainageHoldPanel'
import {
  ensureBeginnerProgrammeRoutine,
  getTrainingState,
  saveTrainingState,
  setWeeklySessionGoal,
  markWeeklyGoalSparkShown,
  setRestReminderPrefs,
  startFreeWorkoutSession,
} from '../services/trainingStorage'
import { saveCalorieProfile, getCalorieProfile } from '../services/nutritionStorage'
import { BEGINNER_PROGRAMME_ID } from '../data/beginnerProgramme'
import { buildBeginnerRoutine } from '../services/beginnerProgramme'
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
import { countSessionsInParisWeek } from '../services/trainWeekProgress'
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
  if (scene === 'goal' || scene === 'spark') {
    notes = [noteOn(today, 'n-today')]
  }
  if (scene === 'rest') {
    notes = [noteOn(yesterday, 'n-y'), noteOn(today, 'n-t')]
  }
  if (scene === 'beginner') {
    notes = []
  }
  const state = getTrainingState()
  saveTrainingState(
    {
      ...state,
      workoutNotes: notes,
      activeWorkoutDraft: null,
      weeklySessionGoal: {
        target: scene === 'spark' ? 1 : 2,
        updatedAt: Date.now(),
        sparkShownWeekKey: null,
      },
      restReminder: { enabled: true, updatedAt: Date.now(), dismissedWeekKey: null },
      routines: [...state.routines.filter((r) => r.id !== BEGINNER_PROGRAMME_ID), buildBeginnerRoutine()],
    },
    { skipCloud: true },
  )
}

export function TrainHubFixture() {
  const scene = useMemo(() => sceneFromQuery(), [])
  const [tick, setTick] = useState(0)
  const [activityOpen, setActivityOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [showGainage, setShowGainage] = useState(scene === 'gainage')

  useEffect(() => {
    seedScene(scene)
    setTick((n) => n + 1)
  }, [scene])

  const state = useMemo(() => getTrainingState(), [tick])
  const now = useMemo(() => new Date(), [tick])
  const weekStrip = deriveWeekStrip(state.workoutNotes, now)
  const weekCount = countSessionsInParisWeek(state.workoutNotes, now)
  const weeklyGoal = parseWeeklySessionGoal(state.weeklySessionGoal)
  const showRest = shouldShowRestReminder(state.workoutNotes, state.restReminder, now)
  const weekEmpty = weekCount === 0

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

        {weekEmpty ? (
          <TrainStartSessionCard
            onStart={() => {
              setActivityOpen(true)
              setStarted(true)
              ensureBeginnerProgrammeRoutine()
              startFreeWorkoutSession('musculation')
              setTick((n) => n + 1)
            }}
          />
        ) : null}

        <TrainWeeklyGoalCard
          doneCount={weekCount}
          target={resolveWeeklySessionGoal(weeklyGoal) as WeeklySessionGoalTarget}
          sparkShownWeekKey={weeklyGoal.sparkShownWeekKey}
          onChangeTarget={(next) => {
            setWeeklySessionGoal(next)
            setTick((n) => n + 1)
          }}
          onSparkShown={(weekKey) => {
            markWeeklyGoalSparkShown(weekKey)
            setTick((n) => n + 1)
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
            setStarted(true)
            setShowGainage(true)
            setTick((n) => n + 1)
          }}
        />

        {showGainage ? <GainageHoldPanel onDone={() => setShowGainage(false)} /> : null}

        {activityOpen || started ? (
          <p className="text-[13px] text-[#8E8E93]" data-testid="train-hub-started">
            Séance démarrée (même chemin que ▶)
          </p>
        ) : null}
      </main>
    </div>
  )
}
