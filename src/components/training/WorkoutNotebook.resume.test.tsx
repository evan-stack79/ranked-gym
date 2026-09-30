/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimerProvider } from '../../context/RestTimerContext'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ActiveWorkoutDraft, ExerciseEntry, WorkoutRoutine } from '../../types/training'

const { persistIndex, draftHolder, callOrder } = vi.hoisted(() => {
  const persistIndex = vi.fn((index: number) => {
    callOrder.push('persistIndex')
    if (!draftHolder.current) return
    draftHolder.current = {
      ...draftHolder.current,
      activeExerciseIndex: index,
      updatedAt: Date.now(),
    }
  })
  const callOrder: string[] = []
  const draftHolder: { current: ActiveWorkoutDraft | null } = {
    current: null,
  }
  return { persistIndex, draftHolder, callOrder }
})

vi.mock('../../services/trainingStorage', () => ({
  DEFAULT_ROUTINES: [{ id: 'live' }, { id: 'upper' }],
  resolveResumedRoutineId: ({ launchRoutineId }: { launchRoutineId?: string | null }) =>
    launchRoutineId ?? 'live',
  setLastSelectedRoutine: vi.fn(),
  getTrainingState: () => ({
    activeWorkoutDraft: draftHolder.current,
    favoriteSportIds: ['musculation'],
    preferredRestSec: 90,
  }),
  persistActiveExerciseIndex: (index: number) => persistIndex(index),
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

function liveDraft(index: number): ActiveWorkoutDraft {
  return {
    routineId: 'live',
    sportId: 'musculation',
    startedAt: 1_000,
    updatedAt: 2_000,
    activeExerciseIndex: index,
    restTimer: null,
  }
}

const exercises: ExerciseEntry[] = [
  {
    id: 'ex-0',
    name: 'Développé couché',
    canonicalExerciseId: 'bench_press',
    sets: [
      { reps: 8, weightKg: 60, done: true, rpe: 8 },
      { reps: 8, weightKg: 60, done: false },
    ],
  },
  {
    id: 'ex-1',
    name: 'Squat',
    canonicalExerciseId: 'back_squat',
    sets: [{ reps: 5, weightKg: 100, done: true, rpe: 7 }],
  },
  {
    id: 'ex-2',
    name: 'Soulevé de terre',
    canonicalExerciseId: 'deadlift',
    sets: [{ reps: 5, weightKg: 120, done: true, rpe: 9 }],
  },
]

const routine: WorkoutRoutine = {
  id: 'live',
  label: 'Musculation',
  subtitle: '',
  accent: '#E22400',
  exercises,
  updatedAt: 2_000,
}

let host: HTMLDivElement
let root: Root
let drafts: ReturnType<typeof vi.fn>

function notebookProps(ex = exercises) {
  return {
    bodyWeightKg: 80,
    routines: [{ ...routine, exercises: ex }],
    history: [],
    initialRoutineId: 'live',
    sportId: 'musculation',
    onSave: vi.fn(),
    onDraftSave: drafts,
    onDeleteNote: vi.fn(),
    onAddRoutine: vi.fn(),
    sessionClockLabel: '00:42',
    sessionPaused: false,
    resume: true,
  }
}

async function renderNotebook(ex?: ExerciseEntry[]) {
  await act(async () => {
    root.render(
      <RestTimerProvider>
        <WorkoutNotebook {...notebookProps(ex)} />
      </RestTimerProvider>,
    )
  })
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  drafts = vi.fn((..._args: unknown[]) => {
    callOrder.push('draftSave')
    if (!draftHolder.current) {
      draftHolder.current = liveDraft(0)
    }
  })
  persistIndex.mockClear()
  callOrder.length = 0
  draftHolder.current = liveDraft(2)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('WorkoutNotebook — reprise de l’exercice courant', () => {
  it('resume + activeExerciseIndex=2 affiche l’exercice 3 même si l’exo 1 a une série ouverte', async () => {
    await renderNotebook()

    const current = host.querySelector('[aria-current="true"]')
    expect(current?.getAttribute('aria-label')).toContain('Exercice 3')
    expect(current?.getAttribute('aria-label')).toContain('Soulevé de terre')
    expect(host.querySelector('p.truncate')?.textContent).toBe('Soulevé de terre')
    expect(host.textContent).toContain('3/3')
  })

  it('commitPickedExercise persiste le nouvel index dans activeWorkoutDraft', async () => {
    draftHolder.current = liveDraft(1)
    await renderNotebook(exercises.slice(0, 2))

    const add = host.querySelector('[data-add-exercise]') as HTMLButtonElement
    expect(add).toBeTruthy()
    await act(async () => add.click())

    const pick = host.querySelector('[data-exercise-id]') as HTMLButtonElement
    expect(pick, 'une entrée du catalogue').toBeTruthy()
    callOrder.length = 0
    persistIndex.mockClear()
    await act(async () => pick.click())

    expect(callOrder[0]).toBe('draftSave')
    expect(callOrder).toContain('persistIndex')
    expect(callOrder.indexOf('persistIndex')).toBeGreaterThan(callOrder.indexOf('draftSave'))
    expect(persistIndex).toHaveBeenCalledWith(2)
    expect(draftHolder.current?.activeExerciseIndex).toBe(2)
  })
})
