/**
 * @vitest-environment jsdom
 *
 * M1 — Terminer / blur doivent partager validateTrainSetNumber avec Valider.
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
    accent: '#FF0702',
    exercises,
    updatedAt: 2_000,
  }
}

type SavePayload = { exercises: Array<{ sets: Array<{ weightKg: number; reps: number }> }> }

describe('WorkoutNotebook Terminer / blur bounds (M1)', () => {
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

  async function renderNotebook(onSave: (payload: SavePayload) => void | Promise<void>) {
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
        />,
      )
    })
  }

  it('blur 501 kg → message + parent inchangé (Terminer ne sauve pas 501)', async () => {
    const savedWeights: number[] = []
    const onSave = vi.fn(async (payload: SavePayload) => {
      savedWeights.push(payload.exercises[0]!.sets[0]!.weightKg)
    })
    await renderNotebook(onSave)
    const kg = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    expect(kg).toBeTruthy()
    await act(async () => {
      kg.focus()
      typeInto(kg, '501')
      kg.blur()
    })
    expect(host.textContent).toMatch(/hors limites/i)
    const terminer = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Terminer la séance'),
    ) as HTMLButtonElement
    await act(async () => {
      terminer.click()
    })
    expect(onSave).toHaveBeenCalled()
    expect(savedWeights).toEqual([20])
  })

  it('Terminer avec 501 kg encore focalisé → aucun onSave + message', async () => {
    const onSave = vi.fn(async () => undefined)
    await renderNotebook(onSave)
    const kg = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      kg.focus()
      typeInto(kg, '501')
    })
    const terminer = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Terminer la séance'),
    ) as HTMLButtonElement
    await act(async () => {
      terminer.click()
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(host.textContent).toMatch(/hors limites|Corrige/i)
  })

  it('Terminer avec Infinity (400×9) → aucun onSave + message', async () => {
    const onSave = vi.fn(async () => undefined)
    await renderNotebook(onSave)
    const kg = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      kg.focus()
      typeInto(kg, '9'.repeat(400))
    })
    const terminer = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Terminer la séance'),
    ) as HTMLButtonElement
    await act(async () => {
      terminer.click()
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(host.textContent).toMatch(/invalide|Corrige|hors limites/i)
  })

  it('valeur valide 100 kg → Terminer sauvegarde 100', async () => {
    const savedWeights: number[] = []
    const onSave = vi.fn(async (payload: SavePayload) => {
      savedWeights.push(payload.exercises[0]!.sets[0]!.weightKg)
    })
    await renderNotebook(onSave)
    const kg = host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      kg.focus()
      typeInto(kg, '100')
      kg.blur()
    })
    const terminer = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Terminer la séance'),
    ) as HTMLButtonElement
    await act(async () => {
      terminer.click()
    })
    expect(onSave).toHaveBeenCalled()
    expect(savedWeights).toEqual([100])
  })
})
