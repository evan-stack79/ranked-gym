/** @vitest-environment jsdom */
/**
 * Train set kg / reps / effort : vider pendant la saisie.
 *
 * Comportement aligné sur le code existant (jamais un 0 inventé) :
 * - kg / reps vides au blur → garde l’ancienne valeur (`required` + restore).
 * - effort vide → `rpe: undefined` → bloque la validation (`isSetReadyForAutoValidate`).
 * - vrai 0 kg tapé reste autorisé (`min={0}`).
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
  scheduleRestTimerSound: vi.fn(async () => {}),
  cancelRestTimerSound: vi.fn(async () => {}),
  rescheduleRestTimerSound: vi.fn(async () => {}),
  onRestTimerSoundComplete: vi.fn(async () => {}),
  maybePlayCountdownBeep: vi.fn(async () => {}),
  previewRestTimerSound: vi.fn(async () => {}),
  getRestTimerSoundPrefs: vi.fn(() => ({
    soundEnabled: true,
    countdownBeeps: true,
    haptics: true,
  })),
  setRestTimerSoundEnabled: vi.fn(),
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

  it('vider reps puis taper 5 → reps 5', async () => {
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

    const reps = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement
    expect(reps.value).toBe('8')

    await act(async () => {
      reps.focus()
      typeInto(reps, '')
    })
    expect(reps.value).toBe('')

    await act(async () => {
      typeInto(reps, '5')
      reps.blur()
    })

    const after = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement
    expect(after.value).toBe('5')
  })

  it('vider reps puis valider → garde les anciennes reps (jamais 0)', async () => {
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

    const reps = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement
    await act(async () => {
      reps.focus()
      typeInto(reps, '')
    })
    expect(reps.value).toBe('')
    for (const call of onUpdate.mock.calls) {
      expect(call[2]).not.toEqual(expect.objectContaining({ reps: 0 }))
    }

    const effort = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effort.focus()
      typeInto(effort, '7')
      effort.blur()
    })

    const repsAfter = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement
    expect(repsAfter.value).toBe('8')
    expect(onValidate).toHaveBeenCalled()
    const validatedSet = onValidate.mock.calls[0]![0] as { reps: number }
    expect(validatedSet.reps).toBe(8)
  })

  it('vider effort puis tenter valider → bloque (jamais rpe 0)', async () => {
    const onValidate = vi.fn()
    const onUpdate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 80, rpe: 7 }] },
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

    const effort = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effort.focus()
      typeInto(effort, '')
      effort.blur()
    })

    const rpePatches = onUpdate.mock.calls
      .map((c) => c[2] as { rpe?: number })
      .filter((p) => 'rpe' in p)
    expect(rpePatches.some((p) => p.rpe === undefined)).toBe(true)
    expect(rpePatches.every((p) => p.rpe !== 0)).toBe(true)
    expect(onValidate).not.toHaveBeenCalled()

    // Re-saisie effort valide → validation possible (gate prête).
    const effortAfter = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effortAfter.focus()
      typeInto(effortAfter, '5')
      effortAfter.blur()
    })
    expect(onValidate).toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith(
      'ex-1',
      0,
      expect.objectContaining({ rpe: 5 }),
    )
  })

  it('taper 100 puis valider sans blur → 100 enregistré', async () => {
    const onValidate = vi.fn()
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
            onValidateSet={(ex, idx, restSec) => {
              onValidate(ex.sets[idx], idx, restSec)
              setExercises((prev) =>
                prev.map((e) =>
                  e.id !== 'ex-1'
                    ? e
                    : {
                        ...e,
                        sets: e.sets.map((s, i) =>
                          i === idx ? { ...s, done: true as const } : s,
                        ),
                      },
                ),
              )
            }}
            onFinishSession={vi.fn()}
            autoValidate={false}
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
      typeInto(weight, '100')
      // pas de blur — commitOnInput doit déjà avoir propagé 100
    })
    expect(weight.value).toBe('100')

    const effort = host.querySelector(
      'input[aria-label="Série 1 effort facultatif"]',
    ) as HTMLInputElement
    await act(async () => {
      effort.focus()
      typeInto(effort, '7')
      effort.blur()
    })

    const validateBtn = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Valider la série'),
    )
    expect(validateBtn).toBeTruthy()
    expect((validateBtn as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      validateBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onValidate).toHaveBeenCalled()
    const validatedSet = onValidate.mock.calls[0]![0] as { weightKg: number }
    expect(validatedSet.weightKg).toBe(100)
  })

  it('saisie incomplète « 2, » → garde l’ancienne valeur', async () => {
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
      typeInto(weight, '2,')
    })
    // Affichage local incomplet ; parent garde 80 (aucun patch weightKg:2).
    expect(weight.value === '2.' || weight.value === '2,').toBe(true)
    for (const call of onUpdate.mock.calls) {
      expect(call[2]).not.toEqual(expect.objectContaining({ weightKg: 2 }))
    }
  })

  it('autoValidate ON : backspace×2 kg → vide, NON validé ; taper 5 + blur → 1 validation à 5', async () => {
    const onValidate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20, rpe: 7 }] },
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
            onValidateSet={(ex, idx, restSec) => {
              onValidate(ex.sets[idx], idx, restSec)
              setExercises((prev) =>
                prev.map((e) =>
                  e.id !== 'ex-1'
                    ? e
                    : {
                        ...e,
                        sets: e.sets.map((s, i) =>
                          i === idx ? { ...s, done: true as const } : s,
                        ),
                      },
                ),
              )
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

    const weight = () =>
      host.querySelector('input[aria-label="Série 1 poids"]') as HTMLInputElement

    await act(async () => {
      weight().focus()
      typeInto(weight(), '2')
      typeInto(weight(), '')
    })
    expect(weight().value).toBe('')
    expect(onValidate).not.toHaveBeenCalled()

    await act(async () => {
      typeInto(weight(), '5')
    })
    expect(onValidate).not.toHaveBeenCalled()

    await act(async () => {
      weight().blur()
    })
    expect(onValidate).toHaveBeenCalledTimes(1)
    expect((onValidate.mock.calls[0]![0] as { weightKg: number }).weightKg).toBe(5)
  })

  it('kg 20 → tout effacer → blur → 20 (pas 2)', async () => {
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20 }] },
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
      typeInto(weight, '2')
      typeInto(weight, '')
      weight.blur()
    })
    expect(
      (host.querySelector('input[aria-label="Série 1 poids"]') as HTMLInputElement).value,
    ).toBe('20')
  })

  it('600 kg → message d’erreur, rien enregistré', async () => {
    const onValidate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20, rpe: 7 }] },
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
            onValidateSet={onValidate}
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
      typeInto(weight, '600')
      weight.blur()
    })
    expect(weight.value).toBe('600')
    expect(host.textContent).toMatch(/Poids hors limites/)
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('0 rep → message d’erreur, rien enregistré', async () => {
    const onValidate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20, rpe: 7 }] },
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
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
            autoValidate
          />
        </RestTimerProvider>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const reps = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement
    await act(async () => {
      reps.focus()
      typeInto(reps, '0')
      reps.blur()
    })
    expect(reps.value).toBe('0')
    expect(host.textContent).toMatch(/Reps hors limites/)
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('kg 20 → vider → Valider clavier ouvert → 20 enregistré', async () => {
    const onValidate = vi.fn()
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20, rpe: 7 }] },
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
            onValidateSet={(ex, idx, restSec) => {
              onValidate(ex.sets[idx], idx, restSec)
            }}
            onFinishSession={vi.fn()}
            autoValidate={false}
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
      typeInto(weight, '2')
      typeInto(weight, '')
    })
    expect(weight.value).toBe('')

    const validateBtn = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Valider la série'),
    )
    expect(validateBtn).toBeTruthy()
    await act(async () => {
      validateBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onValidate).toHaveBeenCalled()
    expect((onValidate.mock.calls[0]![0] as { weightKg: number }).weightKg).toBe(20)
    expect(
      (host.querySelector('input[aria-label="Série 1 poids"]') as HTMLInputElement).value,
    ).toBe('20')
  })

  it('kg 20 → vider → Terminer clavier ouvert → 20 enregistré', async () => {
    const live: { current: ExerciseEntry[] } = {
      current: [{ id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20, rpe: 7 }] }],
    }
    const finished: Array<{ weightKg: number }> = []
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>(live.current)
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
              live.current = live.current.map((e) =>
                e.id !== 'ex-1'
                  ? e
                  : {
                      ...e,
                      sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                    },
              )
              setExercises(live.current)
            }}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={() => {
              finished.push({ weightKg: live.current[0]!.sets[0]!.weightKg })
            }}
            autoValidate={false}
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
      typeInto(weight, '2')
      typeInto(weight, '')
    })
    expect(weight.value).toBe('')

    const finishBtn = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Terminer la séance'),
    )
    expect(finishBtn).toBeTruthy()
    await act(async () => {
      finishBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(
      (host.querySelector('input[aria-label="Série 1 poids"]') as HTMLInputElement).value,
    ).toBe('20')
    expect(finished).toEqual([{ weightKg: 20 }])
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
