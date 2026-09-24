import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ImmersiveExerciseSession } from '../../src/components/training/ImmersiveExerciseSession'
import { RestTimerProvider, useRestTimerContext } from '../../src/context/RestTimerContext'
import type { ExerciseEntry, WorkoutSet } from '../../src/types/training'
import { CANONICAL_REST_SEC } from '../../src/utils/restDuration'
import {
  getTrainingState,
  saveTrainingState,
} from '../../src/services/trainingStorage'

const SESSION_KEY = 'ranked-gym:capture-session-v1'
/** Id routine existant dans DEFAULT_ROUTINES — requis pour normalizeActiveWorkoutDraft. */
const ROUTINE_ID = 'pecs'
const EXERCISE_ID = 'ex-bench-meta'

/**
 * Une seule fixture pour toutes les preuves — nom réel, 2 séries.
 * Série 1 vide pour le flux charge→reps→Effort ; série 2 placeholder.
 */
const SESSION_FIXTURE: ExerciseEntry[] = [
  {
    id: EXERCISE_ID,
    name: 'DÉVELOPPÉ COUCHÉ',
    canonicalExerciseId: 'bench_press',
    sets: [
      { reps: 0, weightKg: 0 },
      { reps: 6, weightKg: 80 },
    ],
  },
]

type StoredSession = {
  exercises: ExerciseEntry[]
  activeIndex: number
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!Array.isArray(parsed.exercises) || !parsed.exercises.length) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(exercises: ExerciseEntry[], activeIndex: number) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ exercises, activeIndex } satisfies StoredSession),
    )
  } catch {
    // ignore quota
  }
}

/** Garantit un brouillon actif (routine connue) pour persistActiveRestTimer / hydrate endsAt. */
function ensureCaptureDraft() {
  const state = getTrainingState()
  const prior = state.activeWorkoutDraft
  if (prior?.routineId === ROUTINE_ID) return
  const now = Date.now()
  saveTrainingState({
    ...state,
    activeWorkoutDraft: {
      routineId: ROUTINE_ID,
      sportId: 'musculation',
      startedAt: now,
      updatedAt: now,
      elapsedActiveMs: 0,
      runningSince: now,
      paused: false,
      // Préserve un restTimer déjà écrit si présent
      restTimer: prior?.restTimer ?? null,
      activeExerciseIndex: 0,
    },
  })
}

function HarnessApp() {
  const params = new URLSearchParams(window.location.search)
  const autoValidate = params.get('autoValidate') !== '0'
  const clear = params.get('clear') === '1'
  const rest = useRestTimerContext()

  const boot = (() => {
    if (clear) {
      try {
        sessionStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignore */
      }
      return { exercises: SESSION_FIXTURE, activeIndex: 0 }
    }
    return readStoredSession() ?? { exercises: SESSION_FIXTURE, activeIndex: 0 }
  })()

  const [exercises, setExercises] = useState(boot.exercises)
  const [activeIndex, setActiveIndex] = useState(boot.activeIndex)
  const [restPrefSec, setRestPrefSec] = useState(CANONICAL_REST_SEC)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    ensureCaptureDraft()
  }, [])

  useEffect(() => {
    writeStoredSession(exercises, activeIndex)
  }, [exercises, activeIndex])

  const updateSet = (exerciseId: string, setIndex: number, patch: Partial<WorkoutSet>) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e
        return {
          ...e,
          sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
        }
      }),
    )
  }

  return (
    <div
      data-harness-ready
      data-fixture="developpe-couche"
      data-auto-validate={autoValidate ? '1' : '0'}
      data-exercise-name={exercises[0]?.name ?? ''}
    >
      <ImmersiveExerciseSession
        exercises={exercises}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        sessionClockLabel="00:42"
        sessionPaused={paused}
        onToggleSessionPause={() => setPaused((v) => !v)}
        onBack={() => undefined}
        onUpdateSet={updateSet}
        onAddSet={(exerciseId) => {
          setExercises((prev) =>
            prev.map((e) =>
              e.id === exerciseId
                ? { ...e, sets: [...e.sets, { reps: 8, weightKg: 20 }] }
                : e,
            ),
          )
        }}
        onValidateSet={(ex, setIndex, restSec) => {
          updateSet(ex.id, setIndex, { done: true })
          ensureCaptureDraft()
          rest.start(restSec || restPrefSec || CANONICAL_REST_SEC, {
            exerciseId: ex.id,
            setIndex,
            exerciseName: ex.name.trim() || 'Exercice',
            setLabel: `S${setIndex + 1}`,
          })
        }}
        onFinishSession={() => undefined}
        restPrefSec={restPrefSec}
        onRestPrefChange={setRestPrefSec}
        autoValidate={autoValidate}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RestTimerProvider>
      <HarnessApp />
    </RestTimerProvider>
  </StrictMode>,
)
