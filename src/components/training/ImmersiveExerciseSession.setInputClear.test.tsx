/** @vitest-environment jsdom */
/**
 * Train set kg/reps : vider pendant la saisie, puis taper une nouvelle valeur.
 * Vide au blur → champ vide (pas « 0 » silencieux).
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImmersiveExerciseSession } from './ImmersiveExerciseSession'
import type { ExerciseEntry } from '../../types/training'
import { RestTimerProvider } from '../../context/RestTimerContext'

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

describe('ImmersiveExerciseSession — clear kg/reps pendant la saisie', () => {
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

  it('vider puis quitter → champ vide, pas 0', async () => {
    function Harness() {
      const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 60 }] },
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
      weight.blur()
    })

    const after = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement
    expect(after.value).toBe('')
    expect(after.value).not.toBe('0')
  })
})
