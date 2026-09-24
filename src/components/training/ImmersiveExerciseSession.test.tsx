// @vitest-environment jsdom
import { act, useRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImmersiveExerciseSession } from './ImmersiveExerciseSession'
import type { ExerciseEntry } from '../../types/training'
import { RestTimerProvider, useRestTimerContext } from '../../context/RestTimerContext'

vi.mock('../../services/trainingStorage', () => ({
  getTrainingState: () => ({ activeWorkoutDraft: null }),
  getTrainingStorageScope: () => 'guest',
  persistActiveRestTimer: vi.fn(),
}))

vi.mock('../../services/restTimerLiveActivity', () => ({
  startRestLiveActivity: vi.fn(),
  updateRestLiveActivity: vi.fn(),
  endRestLiveActivity: vi.fn(),
}))

vi.mock('../../utils/restTimerSound', () => ({
  playRestCompleteChime: vi.fn(),
}))

vi.mock('../../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

/** React-controlled inputs ignore direct `.value =` — use the native setter. */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Evan runtime-shaped séance — titre libre, pas d’ID canonique, 20 kg × 8. */
const realSessionExercises: ExerciseEntry[] = [
  {
    id: 'ex-live-1',
    name: 'DÉVELOPPER',
    sets: [{ reps: 8, weightKg: 20 }],
  },
]

/** Canonical path — photo local when metadata is present. */
const benchCanonicalExercises: ExerciseEntry[] = [
  {
    id: 'ex-bench',
    name: 'DÉVELOPPER',
    canonicalExerciseId: 'bench_press',
    sets: [
      { reps: 6, weightKg: 80, done: true, rpe: 8 },
      { reps: 6, weightKg: 80 },
    ],
  },
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('ImmersiveExerciseSession', () => {
  it('affiche les données réelles DÉVELOPPER 1/1 20×8 sans inventer de photo', async () => {
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={realSessionExercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:42"
            sessionPaused={false}
            onToggleSessionPause={vi.fn()}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>,
      )
    })

    expect(host.querySelector('[data-immersive-session]')).toBeTruthy()
    expect(host.querySelector('[data-exercise-slug="developper"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-image="fallback"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-fallback]')).toBeTruthy()
    expect(host.querySelector('[data-hero-photo]')).toBeNull()
    expect(host.textContent).toContain('DÉVELOPPER')
    expect(host.textContent).toContain('Exercice 1 sur 1')
    expect(host.textContent).not.toContain('Pectoraux')
    expect(host.textContent).not.toContain('Développé couché')
    const weightInput = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement | null
    const repsInput = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement | null
    expect(weightInput?.value).toBe('20')
    expect(repsInput?.value).toBe('8')
    expect(host.textContent).toContain('1/1')
  })

  it('montre la photo locale quand canonicalExerciseId=bench_press (sans renommer le titre)', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={benchCanonicalExercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="13:27"
            sessionPaused={false}
            onToggleSessionPause={vi.fn()}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>,
      )
    })

    expect(host.querySelector('[data-canonical-exercise="bench_press"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-image="ready"]')).toBeTruthy()
    const photo = host.querySelector('[data-hero-photo]') as HTMLImageElement | null
    expect(photo).toBeTruthy()
    expect(photo!.getAttribute('src')).toBeTruthy()
    expect(photo!.getAttribute('alt')).toMatch(/développé couché/i)
    // Titre reste celui de la séance — pas de rename arbitraire
    expect(host.textContent).toContain('DÉVELOPPER')
    expect(host.textContent).toContain('Pectoraux · Triceps · Épaules')
  })

  it('validation auto : Effort requis, pas Facile/OK/Dur, pas de RPE UI', async () => {
    const onValidate = vi.fn()
    const onUpdate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={[
              {
                id: 'ex-1',
                name: 'Squat',
                canonicalExerciseId: 'back_squat',
                sets: [
                  { reps: 8, weightKg: 60 },
                  { reps: 8, weightKg: 60 },
                ],
              },
            ]}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:10"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={onUpdate}
            onAddSet={vi.fn()}
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })

    expect(host.textContent).toContain('Effort')
    expect(host.textContent).not.toContain('Facile')
    expect(host.textContent).not.toContain('Dur')
    expect(host.textContent).not.toMatch(/\bOK\b/)
    expect(host.textContent).not.toContain('RPE')
    expect(host.textContent).not.toContain('Valider la série')
    expect(host.textContent).toContain('1–10')
    expect(onValidate).not.toHaveBeenCalled()

    // Sans Effort : patch poids ne valide pas
    await act(async () => {
      const weight = host.querySelector(
        'input[aria-label="Série 1 poids"]',
      ) as HTMLInputElement
      weight.focus()
      typeInto(weight, '62')
      weight.blur()
    })
    expect(onValidate).not.toHaveBeenCalled()

    // Effort 8 → validation
    await act(async () => {
      const effort = host.querySelector(
        'input[aria-label="Série 1 effort facultatif"]',
      ) as HTMLInputElement
      effort.focus()
      typeInto(effort, '8')
    })
    expect(onUpdate).toHaveBeenCalledWith('ex-1', 0, { rpe: 8 })
    expect(onValidate).toHaveBeenCalledTimes(1)
    expect(onValidate.mock.calls[0][1]).toBe(0)
  })

  it('Effort 1–10 : sélection persiste rpe, jamais RPE dans le DOM', async () => {
    const onUpdate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={[
              {
                id: 'ex-1',
                name: 'Squat',
                sets: [{ reps: 5, weightKg: 100 }],
              },
            ]}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:01"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={onUpdate}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })

    const effortInput = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effortInput.focus()
      typeInto(effortInput, '7')
      effortInput.blur()
    })

    expect(onUpdate).toHaveBeenCalledWith('ex-1', 0, { rpe: 7 })
    expect(host.textContent).toContain('Effort')
    expect(host.textContent).not.toContain('RPE')
    expect(host.textContent).not.toContain('Facile')
  })

  it('absence d’Effort : pas de validation auto, rpe non inventé', async () => {
    const onUpdate = vi.fn()
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={[{ id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 40 }] }]}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:02"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={onUpdate}
            onAddSet={vi.fn()}
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })
    await act(async () => {
      const reps = host.querySelector(
        'input[aria-label="Série 1 reps"]',
      ) as HTMLInputElement
      reps.focus()
      typeInto(reps, '9')
      reps.blur()
    })
    for (const call of onUpdate.mock.calls) {
      expect(call[2]).not.toHaveProperty('rpe')
    }
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('persistance rpe : reload affiche Effort n/10 (pas RPE, pas Facile/OK/Dur)', async () => {
    const stored: ExerciseEntry[] = [
      {
        id: 'ex-reload',
        name: 'Row',
        sets: [
          { reps: 10, weightKg: 50, done: true, rpe: 6 },
          { reps: 10, weightKg: 50 },
        ],
      },
    ]
    // Simule un round-trip storage (JSON) comme trainingStorage
    const reloaded = JSON.parse(JSON.stringify(stored)) as ExerciseEntry[]
    expect(reloaded[0].sets[0].rpe).toBe(6)

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={reloaded}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="01:00"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })
    expect(host.textContent).toContain('6/10')
    expect(host.textContent).toContain('Effort')
    expect(host.textContent).not.toContain('RPE')
    expect(host.textContent).not.toContain('Facile')
    expect(host.textContent).not.toContain('Dur')
  })

  it('lit un rpe 1–10 existant ; difficulté legacy sans rpe n’affiche pas Facile/OK/Dur', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={[
              {
                id: 'ex-1',
                name: 'Squat',
                sets: [
                  { reps: 8, weightKg: 60, done: true, rpe: 8, difficulty: 'hard' },
                  { reps: 8, weightKg: 60, done: true, difficulty: 'easy' },
                  { reps: 8, weightKg: 60 },
                ],
              },
            ]}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:20"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })

    expect(host.textContent).toContain('8/10')
    expect(host.textContent).not.toContain('Facile')
    expect(host.textContent).not.toContain('Dur')
    expect(host.textContent).not.toMatch(/\bOK\b/)
    expect(host.textContent).not.toContain('RPE')
    // Série 2 done sans rpe : input Effort disponible, pas de libellé difficulty
    expect(host.querySelector('input[aria-label="Série 2 effort facultatif"]')).toBeTruthy()
  })

  it('overlay récupération : voile + chrono 01:30, sans bandeau série terminée', async () => {
    function StartRest() {
      const rest = useRestTimerContext()
      return (
        <button
          type="button"
          onClick={() =>
            rest.start(90, {
              exerciseId: 'ex-bench',
              setIndex: 0,
              exerciseName: 'Développé couché',
              setLabel: 'S1',
            })
          }
        >
          arm
        </button>
      )
    }
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <StartRest />
          <ImmersiveExerciseSession
            exercises={[
              {
                id: 'ex-bench',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [
                  { reps: 6, weightKg: 80, done: true, rpe: 7 },
                  { reps: 0, weightKg: 0 },
                ],
              },
              {
                id: 'ex-row',
                name: 'Row barre',
                canonicalExerciseId: 'barbell_row',
                sets: [{ reps: 0, weightKg: 0 }],
              },
            ]}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:46"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>,
      )
    })
    await act(async () => {
      const arm = [...host.querySelectorAll('button')].find((b) => b.textContent === 'arm')
      arm?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(host.querySelector('[data-immersive-session]')?.getAttribute('data-recovery-active')).toBe(
      'true',
    )
    expect(host.querySelector('[data-recovery-veil]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toBe('01:30')
    expect(host.querySelector('[data-recovery-label]')?.textContent).toContain('1 min 30')
    expect(host.textContent).toContain('Reprendre')
    expect(host.textContent).toContain('+15 s')
    expect(host.textContent).not.toMatch(/Série \d+ terminée/)
    expect(host.querySelector('[data-recovery-completed-summary]')).toBeNull()
    expect(host.textContent).not.toContain('+30 s')
    expect(host.textContent).not.toContain('Passer')
    expect(host.textContent).not.toContain('RPE')
    // Corps séance : pas d’opacity forcée (voile séparé)
    expect(host.querySelector('[data-immersive-session-body]')?.className).not.toContain('opacity-')
  })

  it('Effort 8 : validation une seule fois puis chrono à 01:30', async () => {
    const onValidate = vi.fn()
    const onUpdate = vi.fn()
    // Parent simule finishSet + start rest (comme WorkoutNotebook)
    function Harness() {
      const rest = useRestTimerContext()
      const [sets, setSets] = useState([
        { reps: 6, weightKg: 80 },
        { reps: 6, weightKg: 80 },
      ])
      return (
        <ImmersiveExerciseSession
          exercises={[{ id: 'ex-1', name: 'Squat', sets }]}
          activeIndex={0}
          onActiveIndexChange={vi.fn()}
          sessionClockLabel="00:10"
          sessionPaused={false}
          onBack={vi.fn()}
          onUpdateSet={(_id, idx, patch) => {
            onUpdate(_id, idx, patch)
            setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
          }}
          onAddSet={vi.fn()}
          onValidateSet={(ex, setIndex, restSec) => {
            onValidate(ex, setIndex, restSec)
            setSets((prev) =>
              prev.map((s, i) => (i === setIndex ? { ...s, done: true as const } : s)),
            )
            rest.start(restSec || 90, {
              exerciseId: ex.id,
              setIndex,
              exerciseName: ex.name,
              setLabel: `S${setIndex + 1}`,
            })
          }}
          onFinishSession={vi.fn()}
          autoValidate
        />
      )
    }
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Harness />
        </RestTimerProvider>,
      )
    })
    const effortInput = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effortInput.focus()
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set
      setter?.call(effortInput, '8')
      effortInput.dispatchEvent(new Event('input', { bubbles: true }))
      effortInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onValidate).toHaveBeenCalledTimes(1)
    expect(onValidate.mock.calls[0][1]).toBe(0)
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toBe('01:30')
    expect(host.textContent).not.toMatch(/Série \d+ terminée/)
  })

  it('non-régression : série validée survit overlay → réhydratation → Reprendre (rpe=8, série 2 active)', async () => {
    /**
     * Simule le parent réel (WorkoutNotebook) : ref live + round-trip JSON
     * comme trainingStorage. Reprendre = rest.skip() — ne doit PAS reset les séries.
     */
    type Snap = { exercises: ExerciseEntry[] }
    let persisted: Snap = {
      exercises: [
        {
          id: 'ex-bench',
          name: 'DÉVELOPPÉ COUCHÉ',
          canonicalExerciseId: 'bench_press',
          sets: [
            { reps: 6, weightKg: 80 },
            { reps: 6, weightKg: 80 },
          ],
        },
      ],
    }

    function NotebookLike({ initial }: { initial: ExerciseEntry[] }) {
      const rest = useRestTimerContext()
      const [exercises, setExercises] = useState(initial)
      const exercisesRef = useRef(exercises)
      exercisesRef.current = exercises
      const save = (next: ExerciseEntry[]) => {
        exercisesRef.current = next
        setExercises(next)
        persisted = JSON.parse(JSON.stringify({ exercises: next })) as Snap
      }
      return (
        <ImmersiveExerciseSession
          exercises={exercises}
          activeIndex={0}
          onActiveIndexChange={vi.fn()}
          sessionClockLabel="00:42"
          sessionPaused={false}
          onBack={vi.fn()}
          onUpdateSet={(id, idx, patch) => {
            save(
              exercisesRef.current.map((e) =>
                e.id !== id
                  ? e
                  : { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) },
              ),
            )
          }}
          onAddSet={vi.fn()}
          onValidateSet={(ex, setIndex, restSec) => {
            const live = exercisesRef.current
            const current = live.find((e) => e.id === ex.id)?.sets[setIndex]
            if (current?.done) return
            save(
              live.map((e) => {
                if (e.id !== ex.id) return e
                return {
                  ...e,
                  sets: e.sets.map((s, i) =>
                    i === setIndex ? { ...s, done: true as const } : s,
                  ),
                }
              }),
            )
            rest.start(restSec || 90, {
              exerciseId: ex.id,
              setIndex,
              exerciseName: ex.name,
              setLabel: `S${setIndex + 1}`,
            })
          }}
          onFinishSession={vi.fn()}
          autoValidate
        />
      )
    }

    function ReArm({ children }: { children: ReactNode }) {
      const rest = useRestTimerContext()
      return (
        <>
          <button
            type="button"
            data-testid="rearm"
            onClick={() =>
              rest.start(90, {
                exerciseId: 'ex-bench',
                setIndex: 0,
                exerciseName: 'DÉVELOPPÉ COUCHÉ',
                setLabel: 'S1',
              })
            }
          >
            rearm
          </button>
          {children}
        </>
      )
    }

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <NotebookLike initial={persisted.exercises} />
        </RestTimerProvider>,
      )
    })

    await act(async () => {
      const effort = host.querySelector(
        'input[aria-label="Série 1 effort facultatif"]',
      ) as HTMLInputElement
      effort.focus()
      typeInto(effort, '8')
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(persisted.exercises[0].sets[0].rpe).toBe(8)
    expect(persisted.exercises[0].sets[0].done).toBe(true)
    expect(persisted.exercises[0].sets[0].weightKg).toBe(80)
    expect(persisted.exercises[0].sets[0].reps).toBe(6)
    expect(host.textContent).toContain('8/10')

    const rehydrated = JSON.parse(JSON.stringify(persisted.exercises)) as ExerciseEntry[]
    expect(rehydrated[0].sets[0].rpe).toBe(8)
    expect(rehydrated[0].sets[0].done).toBe(true)

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ReArm>
            <NotebookLike initial={rehydrated} />
          </ReArm>
        </RestTimerProvider>,
      )
    })
    await act(async () => {
      host
        .querySelector('[data-testid="rearm"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(host.textContent).toContain('8/10')
    expect(host.querySelector('[data-set-row="done"]')).toBeTruthy()

    await act(async () => {
      host
        .querySelector('[data-recovery-resume]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(persisted.exercises[0].sets[0].rpe).toBe(8)
    expect(persisted.exercises[0].sets[0].done).toBe(true)
    expect(persisted.exercises[0].sets[0].weightKg).toBe(80)
    expect(persisted.exercises[0].sets[0].reps).toBe(6)
    expect(host.textContent).toContain('8/10')
    const rows = [...host.querySelectorAll('[data-set-row]')]
    expect(rows[0]?.getAttribute('data-set-row')).toBe('done')
    expect(rows[1]?.getAttribute('data-set-row')).toBe('active')
    expect(host.textContent).not.toContain('RPE')
  })
})
