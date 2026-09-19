import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ImmersiveExerciseSession } from '../../src/components/training/ImmersiveExerciseSession'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import type { ExerciseEntry, WorkoutSet } from '../../src/types/training'

/**
 * Fixture branchée sur le MÊME composant runtime ImmersiveExerciseSession.
 * Miroir de la séance réelle Evan : titre libre « DÉVELOPPER », 1/1, 20 kg × 8.
 * Pas d’ID canonique → hero fallback (ne pas inventer bench_press depuis le texte).
 */
const REAL_SESSION_FIXTURE: ExerciseEntry[] = [
  {
    id: 'ex-live-developer',
    name: 'DÉVELOPPER',
    sets: [{ reps: 8, weightKg: 20 }],
  },
]

/**
 * Variante preuve photo — même composant, métadonnée canonique explicite.
 * Le titre reste « DÉVELOPPER » (pas de rename) ; l’asset local bench_press s’affiche.
 */
const CANONICAL_BENCH_FIXTURE: ExerciseEntry[] = [
  {
    id: 'ex-bench-meta',
    name: 'DÉVELOPPER',
    canonicalExerciseId: 'bench_press',
    sets: [{ reps: 8, weightKg: 20 }],
  },
]

function pickFixture(): ExerciseEntry[] {
  const params = new URLSearchParams(window.location.search)
  return params.get('fixture') === 'bench_press'
    ? CANONICAL_BENCH_FIXTURE
    : REAL_SESSION_FIXTURE
}

function HarnessApp() {
  const [exercises, setExercises] = useState(pickFixture)
  const [activeIndex, setActiveIndex] = useState(0)
  const [restPrefSec, setRestPrefSec] = useState(90)
  const [paused, setPaused] = useState(false)
  const fixtureKind =
    exercises[0]?.canonicalExerciseId === 'bench_press' ? 'bench_press' : 'real-developper'

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
    <div data-harness-ready data-fixture={fixtureKind}>
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
