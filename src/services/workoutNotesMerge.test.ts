import { describe, expect, it } from 'vitest'
import { mergeWorkoutNotesById } from './workoutNotesMerge'
import type { WorkoutNote } from '../types/training'

function note(partial: Partial<WorkoutNote> & { id: string }): WorkoutNote {
  return {
    title: 'Séance',
    dateKey: '2026-10-08',
    exercises: [],
    createdAt: 1,
    estimatedKcal: 0,
    ...partial,
  }
}

describe('workout notes — per-session updatedAt (water-glass style)', () => {
  it('offline local session survives a stale remote blob (newest-wins by id)', () => {
    const localOnly = note({
      id: 'offline-1',
      title: 'Offline',
      createdAt: 2000,
      updatedAt: 2000,
      dateKey: '2026-10-08',
    })
    const remoteShared = note({
      id: 'shared',
      title: 'Remote old',
      createdAt: 1000,
      updatedAt: 1000,
    })
    const localShared = note({
      id: 'shared',
      title: 'Local newer',
      createdAt: 1000,
      updatedAt: 3000,
    })

    const merged = mergeWorkoutNotesById([localOnly, localShared], [remoteShared])
    expect(merged.map((n) => n.id).sort()).toEqual(['offline-1', 'shared'])
    expect(merged.find((n) => n.id === 'shared')?.title).toBe('Local newer')
    expect(merged.find((n) => n.id === 'offline-1')?.title).toBe('Offline')
  })
})
