// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ExerciseEntry, WorkoutRoutine } from '../../types/training'

vi.mock('../../services/trainingStorage', () => ({
  DEFAULT_ROUTINES: [{ id: 'custom-biceps' }, { id: 'upper' }],
  resolveResumedRoutineId: ({ launchRoutineId }: { launchRoutineId?: string | null }) =>
    launchRoutineId ?? 'custom-biceps',
  setLastSelectedRoutine: vi.fn(),
  getTrainingState: () => ({ activeWorkoutDraft: null }),
  persistActiveExerciseIndex: vi.fn(),
  setPreferredRestSec: vi.fn(),
}))

const squat: ExerciseEntry = {
  id: 'ex-squat',
  name: 'Squat',
  canonicalExerciseId: 'back_squat',
  sets: [{ reps: 5, weightKg: 100 }],
}
const bench: ExerciseEntry = {
  id: 'ex-bench',
  name: 'Développé couché',
  canonicalExerciseId: 'bench_press',
  sets: [{ reps: 8, weightKg: 60 }],
}

function bicepsRoutine(exercises: ExerciseEntry[]): WorkoutRoutine {
  return {
    id: 'custom-biceps',
    label: 'Biceps',
    subtitle: 'Focus bras',
    accent: '#BF5AF2',
    exercises,
    updatedAt: 1,
  }
}

let host: HTMLDivElement
let root: Root
let saves: ReturnType<typeof vi.fn>

const props = (exercises: ExerciseEntry[]) => ({
  bodyWeightKg: 80,
  routines: [bicepsRoutine(exercises)],
  history: [],
  initialRoutineId: 'custom-biceps',
  sportId: 'musculation',
  onSave: saves,
  onDraftSave: vi.fn(),
  onDeleteNote: vi.fn(),
  onAddRoutine: vi.fn(),
})

beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  saves = vi.fn()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})

async function finishSession() {
  const button = [...host.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('Terminer la séance'),
  )
  expect(button, 'Terminer la séance').toBeTruthy()
  await act(async () => {
    button!.click()
  })
}

describe('WorkoutNotebook — titre persisté (pas le label Biceps)', () => {
  it('Squat seul depuis routine Biceps → titre Squat', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props([squat])} />))
    await finishSession()
    expect(saves).toHaveBeenCalled()
    const note = saves.mock.calls[0][0]
    expect(note.title).toBe('Squat')
    expect(note.titleSource).toBe('derived')
    expect(note.exercises[0].name).toBe('Squat')
    expect(note.totalVolumeKg).toBe(500)
  })

  it('Développé couché seul → titre Développé couché', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props([bench])} />))
    await finishSession()
    expect(saves.mock.calls[0][0].title).toBe('Développé couché')
  })

  it('plusieurs exercices → Séance musculation', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props([squat, bench])} />))
    await finishSession()
    expect(saves.mock.calls[0][0].title).toBe('Séance musculation')
  })

  it('champ titre auto = Squat, jamais Biceps', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props([squat])} />))
    const input = host.querySelector('[data-session-title]') as HTMLInputElement
    expect(input?.value).toBe('Squat')
    expect(input?.value).not.toBe('Biceps')
  })
})
