// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ExerciseEntry, WorkoutNote, WorkoutRoutine } from '../../types/training'

vi.mock('../../services/trainingStorage', () => ({
  DEFAULT_ROUTINES: [{ id: 'push' }, { id: 'upper' }],
  resolveResumedRoutineId: ({ launchRoutineId }: { launchRoutineId: string }) => launchRoutineId,
  setLastSelectedRoutine: vi.fn(),
  getTrainingState: () => ({ activeWorkoutDraft: null }),
  persistActiveExerciseIndex: vi.fn(),
  setPreferredRestSec: vi.fn(),
}))
const exercises: ExerciseEntry[] = [{
  id: 'original-exercise', name: 'Développé couché', note: 'Réglage 3',
  sets: [
    { reps: 7, weightKg: 61, done: true, restSec: 83, difficulty: 'hard', rpe: 9 },
    { reps: 9, weightKg: 58, done: false, difficulty: 'easy', rpe: 6 },
  ],
}]
const routine: WorkoutRoutine = {
  id: 'push', label: 'Push', subtitle: '', accent: '#FF2B2B', exercises, updatedAt: 1,
}
const historyNote: WorkoutNote = {
  id: 'historic', title: 'Ancienne séance', routineId: 'push', dateKey: '2026-09-01',
  createdAt: 1, estimatedKcal: 100, sportId: 'musculation', sessionKind: 'strength',
  exercises: [{ id: 'historic-ex', name: 'Développé couché',
    sets: [{ reps: 2, weightKg: 100, done: true, restSec: 180, difficulty: 'easy', rpe: 5 }] }],
}
let host: HTMLDivElement
let root: Root
let drafts: ReturnType<typeof vi.fn>
let saves: ReturnType<typeof vi.fn>
const props = () => ({
  bodyWeightKg: 80, routines: [routine], history: [historyNote], initialRoutineId: 'push',
  sportId: 'musculation', onSave: saves, onDraftSave: drafts,
  onDeleteNote: vi.fn(), onAddRoutine: vi.fn(),
})
beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  drafts = vi.fn()
  saves = vi.fn()
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent?.startsWith(label))
  expect(button, label).toBeTruthy()
  await act(async () => button!.click())
}
describe('Train — reprise et édition sans écrasement au montage', () => {
  it('Reprendre conserve les IDs, valeurs et marqueurs malgré un historique différent', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props()} resume />))
    await act(async () => vi.advanceTimersByTime(800))
    expect(drafts).not.toHaveBeenCalled()
    expect((host.querySelector('input[placeholder^="Exercice"]') as HTMLInputElement)?.value)
      .toBe('Développé couché')
    expect(host.textContent).toContain('83s')
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    expect(drafts).not.toHaveBeenCalled()
    expect(routine.exercises).toEqual(exercises)
  })
  it('édition : ni debounce ni pagehide ne sauvegardent un brouillon', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props()} initialEditNote={historyNote} />))
    await act(async () => {
      vi.advanceTimersByTime(1000)
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(drafts).not.toHaveBeenCalled()
    await click('Annuler l’édition')
    await act(async () => vi.advanceTimersByTime(800))
    expect(drafts).not.toHaveBeenCalled()
  })
  it('sauvegarde historique garde son ID et restaure le brouillon local après édition', async () => {
    await act(async () => root.render(<WorkoutNotebook {...props()} initialEditNote={historyNote} />))
    await click('Sauvegarder')
    expect(saves).toHaveBeenCalledWith(expect.objectContaining({
      id: historyNote.id, createdAt: historyNote.createdAt, exercises: historyNote.exercises,
    }))
    await act(async () => vi.advanceTimersByTime(800))
    expect(drafts).not.toHaveBeenCalled()
  })
})
