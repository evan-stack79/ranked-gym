/** @vitest-environment jsdom */
/**
 * Train set kg / reps / effort : vider pendant la saisie.
 * kg/reps vides au blur → ancienne valeur (jamais 0 silencieux).
 * effort vide → bloque la validation (isSetReadyForAutoValidate).
 * Vrai 0 kg tapé reste autorisé.
 */
import { act, useState } from 'react'
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

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('ImmersiveExerciseSession — clear kg/reps/effort', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
    document.body.innerHTML = ''
  })

  it('vider puis taper 5 → poids 5', async () => {
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 80 }] },
      ])
      return (
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:01"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={(_id, idx, patch) => {
              setExercises((prev) =>
                prev.map((e) =>
                  e.id !== 'ex-1'
                    ? e
                    : {
                        ...e,
                        sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                      },
                ),
              )
            }}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const weight = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    expect(weight.value).toBe('80')

    await act(async () => {
      weight.focus()
      typeInto(weight, '')
    })
    expect(weight.value).toBe('')

    await act(async () => {
      typeInto(weight, '5')
      weight.blur()
    })

    const after = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    expect(after.value).toBe('5')
  })

  it('vider puis valider → garde l’ancienne charge (jamais 0 silencieux)', async () => {
    const onValidate = vi.fn()
    const onUpdate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 80 }] },
      ])
      return (
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:01"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={(_id, idx, patch) => {
              onUpdate(_id, idx, patch)
              setExercises((prev) =>
                prev.map((e) =>
                  e.id !== 'ex-1'
                    ? e
                    : {
                        ...e,
                        sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                      },
                ),
              )
            }}
            onAddSet={vi.fn()}
            onValidateSet={(ex, idx, restSec) => {
              onValidate(ex.sets[idx], idx, restSec)
            }}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const weight = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    await act(async () => {
      weight.focus()
      typeInto(weight, '')
    })
    expect(weight.value).toBe('')
    // Aucun patch weightKg:0 pendant le clear.
    for (const call of onUpdate.mock.calls) {
      expect(call[2]).not.toEqual(expect.objectContaining({ weightKg: 0 }))
    }

    const effort = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      // Blur poids → restaure 80 ; puis Effort déclenche la validation.
      effort.focus()
      typeInto(effort, '7')
      effort.blur()
    })

    const weightAfter = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    expect(weightAfter.value).toBe('80')
    expect(onValidate).toHaveBeenCalled()
    const validatedSet = onValidate.mock.calls[0]![0] as { weightKg: number }
    expect(validatedSet.weightKg).toBe(80)
  })

  it('taper un vrai 0 kg → enregistré 0 (déjà autorisé)', async () => {
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 80 }] },
      ])
      return (
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:01"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={(_id, idx, patch) => {
              setExercises((prev) =>
                prev.map((e) =>
                  e.id !== 'ex-1'
                    ? e
                    : {
                        ...e,
                        sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                      },
                ),
              )
            }}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const weight = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    await act(async () => {
      weight.focus()
      typeInto(weight, '')
      typeInto(weight, '0')
      weight.blur()
    })

    const after = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    expect(after.value).toBe('0')
  })

  it('bouton Reprendre (repos) non cassé après saisie charge', async () => {
    function StartRest() {
      const rest = useRestTimerContext()
      return (
        <button
          type="button"
          onClick={() =>
            rest.start(90, {
              exerciseId: 'ex-1',
              setIndex: 0,
              exerciseName: 'Squat',
              setLabel: 'S1',
            })
          }
        >
          arm
        </button>
      )
    }

    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        {
          id: 'ex-1',
          name: 'Squat',
          sets: [
            { reps: 6, weightKg: 80, done: true, rpe: 7 },
            { reps: 6, weightKg: 80 },
          ],
        },
      ])
      const rest = useRestTimerContext()
      return (
        <>
          <StartRest />
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:10"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={(_id, idx, patch) => {
              setExercises((prev) =>
                prev.map((e) => ({
                  ...e,
                  sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                })),
              )
            }}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
            autoValidate
          />
          <button type="button" data-testid="force-skip" onClick={() => rest.skip()}>
            skip
          </button>
        </>
      )
    }

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Harness />
        </RestTimerProvider>,
      )
    })

    await act(async () => {
      const arm = [...host.querySelectorAll('button')].find((b) => b.textContent === 'arm')
      arm?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.textContent).toContain('Reprendre')

    const resume = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Reprendre'),
    )
    expect(resume).toBeTruthy()
    await act(async () => {
      resume!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Reprendre ferme l’overlay ; la série 2 reste active (pas d’append).
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(host.querySelector('[data-set-row="active"]')).toBeTruthy()
    expect(host.querySelectorAll('[data-set-row]')).toHaveLength(2)
  })
})
