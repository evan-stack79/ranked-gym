/** @vitest-environment jsdom */
/**
 * Carnet (liste des séries, pas immersive) — case kg : backspace jusqu’à vide.
 * Repro Evan iPhone : « 20 » → effacer 0 OK, dernier « 2 » refusé.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ExerciseEntry, WorkoutRoutine } from '../../types/training'

vi.mock('../../backend/trainingFeatureFlags', () => ({
  isAutoSetValidationEnabled: () => false,
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
          // Pas de sessionClock → UI carnet (liste), pas immersive.
          sessionClockLabel={null}
        />,
      )
    })

    const weight = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    expect(weight).toBeTruthy()
    expect(weight.value).toBe('20')

    await act(async () => {
      weight.focus()
      // Backspace 1 : « 20 » → « 2 »
      typeInto(weight, '2')
    })
    expect(weight.value).toBe('2')

    await act(async () => {
      // Backspace 2 : « 2 » → '' (ne doit PAS être refusé / re-rempli)
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

  it('blur sur kg vide → restaure l’ancienne valeur (pas 0)', async () => {
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
      typeInto(weight, '')
      weight.blur()
    })
    expect(
      (host.querySelector('input[aria-label="Poids"]') as HTMLInputElement).value,
    ).toBe('20')
  })
})
