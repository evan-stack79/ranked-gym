import { describe, expect, it } from 'vitest'
import {
  deriveSessionDisplayTitle,
  namedSessionExercises,
  resolveExerciseDisplayName,
} from './sessionDisplayTitle'
import type { ExerciseEntry } from '../types/training'

function ex(partial: Partial<ExerciseEntry> & Pick<ExerciseEntry, 'id'>): ExerciseEntry {
  return {
    name: '',
    sets: [{ reps: 8, weightKg: 60 }],
    ...partial,
  }
}

describe('deriveSessionDisplayTitle', () => {
  it('1 exo catalogue → nom réel (pas le label routine Biceps)', () => {
    const exercises = [
      ex({ id: '1', name: 'Développé couché', canonicalExerciseId: 'bench_press' }),
    ]
    expect(deriveSessionDisplayTitle(exercises, 'Biceps')).toBe('Développé couché')
  })

  it('1 exo custom sans canonique → name trim', () => {
    expect(
      deriveSessionDisplayTitle([ex({ id: '1', name: 'Mon curl' })], 'Biceps'),
    ).toBe('Mon curl')
  })

  it('multi → nom user s’il est défini', () => {
    const exercises = [
      ex({ id: '1', name: 'Développé couché', canonicalExerciseId: 'bench_press' }),
      ex({ id: '2', name: 'Squat', canonicalExerciseId: 'back_squat' }),
    ]
    expect(deriveSessionDisplayTitle(exercises, 'Push du soir')).toBe('Push du soir')
  })

  it('multi sans nom user → Musculation (jamais muscle inventé)', () => {
    const exercises = [
      ex({ id: '1', name: 'Développé couché', canonicalExerciseId: 'bench_press' }),
      ex({ id: '2', name: 'Squat', canonicalExerciseId: 'back_squat' }),
    ]
    expect(deriveSessionDisplayTitle(exercises, '')).toBe('Musculation')
    expect(deriveSessionDisplayTitle(exercises, null)).toBe('Musculation')
  })

  it('0 exo → label user ou Séance', () => {
    expect(deriveSessionDisplayTitle([], 'Biceps')).toBe('Biceps')
    expect(deriveSessionDisplayTitle([], '')).toBe('Séance')
  })

  it('ignore les lignes sans nom ni canonique', () => {
    expect(namedSessionExercises([ex({ id: '1', name: '  ' })])).toHaveLength(0)
    expect(resolveExerciseDisplayName(ex({ id: '1', canonicalExerciseId: 'bench_press', name: 'x' }))).toBe(
      'Développé couché',
    )
  })
})
