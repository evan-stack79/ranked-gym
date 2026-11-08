/** @vitest-environment jsdom */
/**
 * QA PR119 — carnet sans auto-validation : effort vide bloque Valider (jamais rpe 0).
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
}))

vi.mock('../../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

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

describe('WorkoutNotebook — carnet effort gate (auto OFF)', () => {
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

  it('carnet sans auto-validation, effort vide → bloque', async () => {
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Squat',
        sets: [{ reps: 8, weightKg: 80 }],
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
          // Pas de sessionClock → UI carnet (bouton Valider), pas immersive.
          sessionClockLabel={null}
        />,
      )
    })

    const validateBtn = [...host.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').trim().includes('Valider'),
    )
    expect(validateBtn).toBeTruthy()
    expect((validateBtn as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      validateBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Série toujours ouverte — pas de done, pas de rpe inventé.
    expect(host.querySelector('input[aria-label="Effort facultatif, 1 à 10"]')).toBeTruthy()
    expect(host.textContent).not.toMatch(/\b0\/10\b/)
  })
})
