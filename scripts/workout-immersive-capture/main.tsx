import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ImmersiveExerciseSession } from '../../src/components/training/ImmersiveExerciseSession'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import type { ExerciseEntry, WorkoutSet } from '../../src/types/training'

/** Fixture réelle de séance — aucune persistance ; harness capture uniquement. */
const FIXTURE: ExerciseEntry[] = [
  {
    id: 'ex-warmup',
    name: 'Échauffement rotator cuff',
    sets: [{ reps: 15, weightKg: 4, done: true }],
  },
  {
    id: 'ex-pushups',
    name: 'Pompes',
    sets: [{ reps: 12, weightKg: 0, done: true }],
  },
  {
    id: 'ex-bench',
    name: 'Développé couché',
    sets: [
      { reps: 6, weightKg: 80, done: true, rpe: 8 },
      { reps: 6, weightKg: 80 },
      { reps: 8, weightKg: 100 },
      { reps: 8, weightKg: 102.5 },
    ],
  },
  {
    id: 'ex-ohp',
    name: 'Développé militaire',
    sets: [{ reps: 8, weightKg: 40 }],
  },
  {
    id: 'ex-fly',
    name: 'Écarté haltères',
    sets: [{ reps: 12, weightKg: 16 }],
  },
  {
    id: 'ex-dips',
    name: 'Dips',
    sets: [{ reps: 10, weightKg: 0 }],
  },
  {
    id: 'ex-pushdown',
    name: 'Triceps poulie',
    sets: [{ reps: 12, weightKg: 25 }],
  },
  {
    id: 'ex-face',
    name: 'Face pull',
    sets: [{ reps: 15, weightKg: 15 }],
  },
]

function HarnessApp() {
  const [exercises, setExercises] = useState(FIXTURE)
  const [activeIndex, setActiveIndex] = useState(2)
  const [restPrefSec, setRestPrefSec] = useState(90)
  const [paused, setPaused] = useState(false)

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
    <div data-harness-ready data-fixture="developpe-couche">
      <ImmersiveExerciseSession
        exercises={exercises}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        sessionClockLabel="13:27"
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
        onValidateSet={(ex, setIndex) => {
          updateSet(ex.id, setIndex, { done: true })
        }}
        onFinishSession={() => undefined}
        restPrefSec={restPrefSec}
        onRestPrefChange={setRestPrefSec}
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
