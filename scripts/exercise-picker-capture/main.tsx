import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ExercisePicker } from '../../src/components/training/ExercisePicker'
import { ImmersiveExerciseSession } from '../../src/components/training/ImmersiveExerciseSession'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import type { CatalogExercise } from '../../src/data/exerciseCatalog'
import type { ExerciseEntry, WorkoutSet } from '../../src/types/training'

function entryFromCatalog(ex: CatalogExercise): ExerciseEntry {
  return {
    id: `ex-${Date.now()}`,
    name: ex.name,
    canonicalExerciseId: ex.id,
    sets: [{ reps: 8, weightKg: 20 }],
  }
}

function entryFromCustom(name: string): ExerciseEntry {
  return {
    id: `ex-${Date.now()}`,
    name: name.trim() || 'Exercice',
    sets: [{ reps: 8, weightKg: 20 }],
  }
}

function HarnessApp() {
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [restPrefSec, setRestPrefSec] = useState(90)
  const [paused, setPaused] = useState(false)
  const [pickerMode, setPickerMode] = useState<'first' | 'add' | null>('first')

  const showPicker = pickerMode != null || exercises.length === 0

  if (showPicker) {
    return (
      <div data-harness-ready data-phase="picker">
        <ExercisePicker
          mode={pickerMode === 'add' ? 'add' : 'first'}
          onBack={() => {
            if (exercises.length === 0) return
            setPickerMode(null)
          }}
          onSelect={(ex) => {
            const entry = entryFromCatalog(ex)
            setExercises((prev) => {
              const next = [...prev, entry]
              setActiveIndex(next.length - 1)
              return next
            })
            setPickerMode(null)
          }}
          onCreateCustom={(name) => {
            const entry = entryFromCustom(name)
            setExercises((prev) => {
              const next = [...prev, entry]
              setActiveIndex(next.length - 1)
              return next
            })
            setPickerMode(null)
          }}
        />
      </div>
    )
  }

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
    <div data-harness-ready data-phase="immersive">
      <ImmersiveExerciseSession
        exercises={exercises}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        sessionClockLabel="00:12"
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
        onAddExercise={() => setPickerMode('add')}
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
