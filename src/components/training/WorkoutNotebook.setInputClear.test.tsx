/** @vitest-environment jsdom */
/**
 * IPA #131 — carnet (WorkoutNotebook) : impossible de vider les kg.
 *
 * Flux bug (HEAD) :
 * 1. ClearableNumberInput type=text inputMode=decimal + commitOnBlur + fieldKind
 * 2. clear → onChange(null) immédiat
 * 3. parent `if (v == null) return` → weightKg reste 20
 * 4. blur required → restore focusValue 20 (ou re-render value=20 remplit le text)
 *
 * Fix : parent écrit NaN ; value prop = null si !Number.isFinite ; fieldKind
 * garde le vide au blur ; Valider/Terminer refusent.
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

  it('kg 20 → tout effacer → blur → reste vide (pas restore 20)', async () => {
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
    ).toBe('')
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
    // M1 : hors bornes refusées au blur — affichage restauré, message, parent inchangé.
    expect(weight.value).toBe('20')
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
    // M1 : 0 rep hors bornes (1–50) — refus + restauration, pas d’écriture parent.
    expect(reps.value).toBe('8')
    expect(host.textContent).toMatch(/Reps hors limites/)
    expect(onRestStart).not.toHaveBeenCalled()
  })

  it('kg 20 → vider → Valider désactivé (effort/ready gate) ; champ reste vide', async () => {
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
    ) as HTMLButtonElement | undefined
    expect(validateBtn).toBeTruthy()
    // NaN kg → !isSetReadyForAutoValidate → bouton disabled (pas de validation).
    expect(validateBtn!.disabled).toBe(true)
    await act(async () => {
      validateBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRestStart).not.toHaveBeenCalled()
    expect(
      (host.querySelector('input[aria-label="Poids"]') as HTMLInputElement | null)?.value,
    ).toBe('')
  })

  it('kg 20 → vider → Terminer clavier ouvert → refus (pas de save)', async () => {
    autoValidateFlag.on = false
    const savedWeights: number[] = []
    const onSave = vi.fn(
      async (payload: { exercises: Array<{ sets: Array<{ weightKg: number }> }> }) => {
        savedWeights.push(payload.exercises[0]!.sets[0]!.weightKg)
      },
    )
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

    expect(onSave).not.toHaveBeenCalled()
    expect(savedWeights).toEqual([])
    // Terminer passe par workoutSessionSaveError(NaN) → « Poids invalide »
    expect(host.textContent).toMatch(/Poids invalide/i)
  })

  it('input kg : type=text + inputMode=decimal (pas type=number iOS)', async () => {
    await act(async () => {
      root.render(
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[
            makeRoutine([{ id: 'ex-1', name: 'Squat', sets: [{ reps: 8, weightKg: 20 }] }]),
          ]}
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
    expect(weight.type).toBe('text')
    expect(weight.inputMode).toBe('decimal')
  })
})
