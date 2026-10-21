/** @vitest-environment jsdom */
/**
 * QA boucle 3 — carnet kg clear / autoValidate blur-only / pas de clamp silencieux.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimerProvider } from '../../context/RestTimerContext'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ExerciseEntry, WorkoutRoutine } from '../../types/training'

const autoValidateFlag = vi.hoisted(() => ({ on: false }))

vi.mock('../../backend/trainingFeatureFlags', () => ({
  isAutoSetValidationEnabled: () => autoValidateFlag.on,
}))

vi.mock('../../services/trainingStorage', () => ({
  DEFAULT_ROUTINES: [{ id: 'live' }, { id: 'upper' }],
  resolveResumedRoutineId: ({ launchRoutineId }: { launchRoutineId?: string | null }) =>
    launchRoutineId ?? 'live',
  setLastSelectedRoutine: vi.fn(),
  getTrainingState: () => ({
    activeWorkoutDraft: null,
    favoriteSportIds: ['musculation'],
    preferredRestSec: 90,
  }),
  persistActiveExerciseIndex: vi.fn(),
  persistActiveRestTimer: vi.fn(),
  getTrainingStorageScope: () => 'guest',
  setPreferredRestSec: vi.fn(),
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

function makeRoutine(exercises: ExerciseEntry[]): WorkoutRoutine {
  return {
    id: 'live',
    label: 'Musculation',
    subtitle: '',
    accent: '#FF2B2B',
    exercises,
    updatedAt: 2_000,
  }
}

describe('WorkoutNotebook — carnet kg clear (liste séries)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    autoValidateFlag.on = false
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  it('valeur 20, backspace×2 → input vide ; taper 5 → 5', async () => {
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20 }],
      },
    ]

    await act(async () => {
      root.render(
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[makeRoutine(exercises)]}
          history={[]}
          initialRoutineId="live"
          sportId="musculation"
          onSave={vi.fn()}
          onDraftSave={vi.fn()}
          onDeleteNote={vi.fn()}
          onAddRoutine={vi.fn()}
          sessionClockLabel={null}
        />,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    expect(weight).toBeTruthy()
    expect(weight.value).toBe('20')

    await act(async () => {
      weight.focus()
      typeInto(weight, '2')
    })
    expect(weight.value).toBe('2')

    await act(async () => {
      typeInto(weight, '')
    })
    expect(weight.value).toBe('')

    await act(async () => {
      typeInto(weight, '5')
      weight.blur()
    })
    expect(
      (host.querySelector('input[aria-label="Poids"]') as HTMLInputElement).value,
    ).toBe('5')
  })

  it('kg 20 → tout effacer → blur → 20 (pas 2)', async () => {
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20 }],
      },
    ]

    await act(async () => {
      root.render(
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[makeRoutine(exercises)]}
          history={[]}
          initialRoutineId="live"
          sportId="musculation"
          onSave={vi.fn()}
          onDraftSave={vi.fn()}
          onDeleteNote={vi.fn()}
          onAddRoutine={vi.fn()}
          sessionClockLabel={null}
        />,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      weight.focus()
      typeInto(weight, '2')
      typeInto(weight, '')
      weight.blur()
    })
    expect(
      (host.querySelector('input[aria-label="Poids"]') as HTMLInputElement).value,
    ).toBe('20')
  })

  it('autoValidate ON : backspace×2 kg → case vide, série NON validée, pas de repos ; taper 5 puis blur → 1 validation à 5', async () => {
    autoValidateFlag.on = true
    const onRestStart = vi.fn()
    // resume → copyExercises (garde rpe) ; cloneFromRoutine l’efface.
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20, rpe: 7 }],
      },
    ]

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <WorkoutNotebook
            bodyWeightKg={80}
            routines={[makeRoutine(exercises)]}
            history={[]}
            initialRoutineId="live"
            sportId="musculation"
            onSave={vi.fn()}
            onDraftSave={vi.fn()}
            onDeleteNote={vi.fn()}
            onAddRoutine={vi.fn()}
            sessionClockLabel={null}
            resume
            onRestStart={onRestStart}
          />
        </RestTimerProvider>,
      )
    })

    const weight = () => host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    const effort = host.querySelector(
      'input[aria-label="Effort facultatif, 1 à 10"]',
    ) as HTMLInputElement
    expect(weight().value).toBe('20')
    expect(effort.value).toBe('7')

    await act(async () => {
      weight().focus()
      typeInto(weight(), '2')
      typeInto(weight(), '')
    })
    expect(weight().value).toBe('')
    expect(onRestStart).not.toHaveBeenCalled()
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(host.textContent).not.toMatch(/Annuler/)

    await act(async () => {
      typeInto(weight(), '5')
    })
    expect(weight().value).toBe('5')
    expect(onRestStart).not.toHaveBeenCalled()

    await act(async () => {
      weight().blur()
    })
    expect(onRestStart).toHaveBeenCalledTimes(1)
    expect(weight().value).toBe('5')
  })

  it('600 kg → message d’erreur, rien enregistré (pas de validation)', async () => {
    autoValidateFlag.on = true
    const onRestStart = vi.fn()
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20, rpe: 7 }],
      },
    ]

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <WorkoutNotebook
            bodyWeightKg={80}
            routines={[makeRoutine(exercises)]}
            history={[]}
            initialRoutineId="live"
            sportId="musculation"
            onSave={vi.fn()}
            onDraftSave={vi.fn()}
            onDeleteNote={vi.fn()}
            onAddRoutine={vi.fn()}
            sessionClockLabel={null}
            resume
            onRestStart={onRestStart}
          />
        </RestTimerProvider>,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      weight.focus()
      typeInto(weight, '600')
      weight.blur()
    })
    expect(weight.value).toBe('600')
    expect(host.textContent).toMatch(/Poids hors limites/)
    expect(onRestStart).not.toHaveBeenCalled()
  })

  it('0 rep → message d’erreur, rien enregistré', async () => {
    autoValidateFlag.on = true
    const onRestStart = vi.fn()
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20, rpe: 7 }],
      },
    ]

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <WorkoutNotebook
            bodyWeightKg={80}
            routines={[makeRoutine(exercises)]}
            history={[]}
            initialRoutineId="live"
            sportId="musculation"
            onSave={vi.fn()}
            onDraftSave={vi.fn()}
            onDeleteNote={vi.fn()}
            onAddRoutine={vi.fn()}
            sessionClockLabel={null}
            resume
            onRestStart={onRestStart}
          />
        </RestTimerProvider>,
      )
    })

    const reps = host.querySelector('input[aria-label="Reps"]') as HTMLInputElement
    await act(async () => {
      reps.focus()
      typeInto(reps, '0')
      reps.blur()
    })
    expect(reps.value).toBe('0')
    expect(host.textContent).toMatch(/Reps hors limites/)
    expect(onRestStart).not.toHaveBeenCalled()
  })

  it('kg 20 → vider → Valider clavier ouvert → 20 enregistré', async () => {
    autoValidateFlag.on = false
    const onRestStart = vi.fn()
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20, rpe: 7 }],
      },
    ]

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <WorkoutNotebook
            bodyWeightKg={80}
            routines={[makeRoutine(exercises)]}
            history={[]}
            initialRoutineId="live"
            sportId="musculation"
            onSave={vi.fn()}
            onDraftSave={vi.fn()}
            onDeleteNote={vi.fn()}
            onAddRoutine={vi.fn()}
            sessionClockLabel={null}
            resume
            onRestStart={onRestStart}
          />
        </RestTimerProvider>,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      weight.focus()
      typeInto(weight, '2')
      typeInto(weight, '')
      // Pas de blur — clavier ouvert
    })
    expect(weight.value).toBe('')

    const validateBtn = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').trim().includes('Valider'),
    )
    expect(validateBtn).toBeTruthy()
    await act(async () => {
      validateBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRestStart).toHaveBeenCalledTimes(1)
    expect(
      (host.querySelector('input[aria-label="Poids"]') as HTMLInputElement | null)?.value ?? '20',
    ).toBe('20')
  })

  it('kg 20 → vider → Terminer clavier ouvert → 20 enregistré', async () => {
    autoValidateFlag.on = false
    const onSave = vi.fn(async () => {})
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 20, rpe: 7 }],
      },
    ]

    await act(async () => {
      root.render(
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[makeRoutine(exercises)]}
          history={[]}
          initialRoutineId="live"
          sportId="musculation"
          onSave={onSave}
          onDraftSave={vi.fn()}
          onDeleteNote={vi.fn()}
          onAddRoutine={vi.fn()}
          sessionClockLabel={null}
          resume
        />,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
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

    expect(onSave).toHaveBeenCalled()
    const saved = onSave.mock.calls[0]![0] as {
      exercises: Array<{ sets: Array<{ weightKg: number }> }>
    }
    expect(saved.exercises[0]!.sets[0]!.weightKg).toBe(20)
  })
})
