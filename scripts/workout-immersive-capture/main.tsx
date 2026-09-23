import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ImmersiveExerciseSession } from '../../src/components/training/ImmersiveExerciseSession'
import { RestTimerProvider, useRestTimerContext } from '../../src/context/RestTimerContext'
import type { ExerciseEntry, WorkoutSet } from '../../src/types/training'
import { CANONICAL_REST_SEC } from '../../src/utils/restDuration'

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
    sets: [
      { reps: 6, weightKg: 80 },
      { reps: 6, weightKg: 80 },
    ],
  },
]

/** Fixture récupération — série 1 déjà validée (80×6), timer armé à 47 s restants. */
const RECOVERY_FIXTURE: ExerciseEntry[] = [
  {
    id: 'ex-bench-meta',
    name: 'DÉVELOPPÉ COUCHÉ',
    canonicalExerciseId: 'bench_press',
    sets: [
      { reps: 6, weightKg: 80, done: true, rpe: 8 },
      { reps: 6, weightKg: 90 },
      { reps: 6, weightKg: 90 },
      { reps: 6, weightKg: 90 },
    ],
  },
]

function pickFixture(): ExerciseEntry[] {
  const params = new URLSearchParams(window.location.search)
  if (params.get('fixture') === 'recovery') return RECOVERY_FIXTURE
  return params.get('fixture') === 'bench_press'
    ? CANONICAL_BENCH_FIXTURE
    : REAL_SESSION_FIXTURE
}

function RestArmer({
  enabled,
  remainingSec,
  target,
}: {
  enabled: boolean
  remainingSec: number
  target: { exerciseId: string; setIndex: number; exerciseName: string; setLabel: string }
}) {
  const rest = useRestTimerContext()
  useEffect(() => {
    if (!enabled) return
    rest.start(remainingSec, target)
    // Arm once for capture fixture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  return null
}

function HarnessApp() {
  const params = new URLSearchParams(window.location.search)
  const autoValidate = params.get('autoValidate') === '1' || params.get('fixture') === 'recovery'
  const recoveryMode = params.get('fixture') === 'recovery'
  const [exercises, setExercises] = useState(pickFixture)
  const [activeIndex, setActiveIndex] = useState(0)
  const [restPrefSec, setRestPrefSec] = useState(CANONICAL_REST_SEC)
  const [paused, setPaused] = useState(false)
  const rest = useRestTimerContext()
  const fixtureKind =
    recoveryMode
      ? 'recovery'
      : exercises[0]?.canonicalExerciseId === 'bench_press'
        ? 'bench_press'
        : 'real-developper'

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
      data-fixture={fixtureKind}
      data-auto-validate={autoValidate ? '1' : '0'}
      data-recovery-mode={recoveryMode ? '1' : '0'}
    >
      {recoveryMode ? (
        <RestArmer
          enabled
          remainingSec={CANONICAL_REST_SEC}
          target={{
            exerciseId: 'ex-bench-meta',
            setIndex: 0,
            exerciseName: 'DÉVELOPPÉ COUCHÉ',
            setLabel: 'S1',
          }}
        />
      ) : null}
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
