import { describe, expect, it } from 'vitest'
import type { WorkoutNote, WorkoutSet } from '../types/training'
import {
  exerciseMatches,
  findLastPerformance,
  formatLastRepsAriaLabel,
  formatLastRepsPlaceholder,
  formatLastWeightAriaLabel,
  formatLastWeightPlaceholder,
  isSetLoadBlank,
  lastPerformanceToSetPatch,
  nextSetFromPrevious,
  pickSetForIndex,
} from './lastPerformance'

function note(
  partial: Partial<WorkoutNote> & Pick<WorkoutNote, 'id' | 'dateKey' | 'createdAt' | 'exercises'>,
): WorkoutNote {
  return {
    title: partial.title ?? 'Séance',
    estimatedKcal: partial.estimatedKcal ?? 0,
    ...partial,
  }
}

const history: WorkoutNote[] = [
  note({
    id: 'newer',
    dateKey: '2026-10-05',
    createdAt: 3_000,
    exercises: [
      {
        id: 'e-bench',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 8, weightKg: 60, rpe: 8 },
          { reps: 6, weightKg: 65, rpe: 9 },
        ],
      },
    ],
  }),
  note({
    id: 'older',
    dateKey: '2026-09-28',
    createdAt: 1_000,
    exercises: [
      {
        id: 'e-bench-old',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [{ reps: 10, weightKg: 50 }],
      },
    ],
  }),
]

describe('findLastPerformance', () => {
  it('retourne la série au même index de la séance complétée la plus récente', () => {
    const perf = findLastPerformance(
      history,
      { name: 'Développé couché', canonicalExerciseId: 'bench_press' },
      0,
    )
    expect(perf).toEqual({
      weightKg: 60,
      reps: 8,
      dateKey: '2026-10-05',
      sourceSetIndex: 0,
    })
  })

  it('retourne la 2ᵉ série quand setIndex = 1', () => {
    const perf = findLastPerformance(
      history,
      { name: 'Développé couché', canonicalExerciseId: 'bench_press' },
      1,
    )
    expect(perf?.weightKg).toBe(65)
    expect(perf?.reps).toBe(6)
    expect(perf?.sourceSetIndex).toBe(1)
  })

  it('fallback sur la dernière série si l’index n’existe pas', () => {
    const perf = findLastPerformance(
      history,
      { name: 'Développé couché', canonicalExerciseId: 'bench_press' },
      4,
    )
    expect(perf?.weightKg).toBe(65)
    expect(perf?.reps).toBe(6)
    expect(perf?.sourceSetIndex).toBe(1)
  })

  it('retourne null s’il n’y a pas de données', () => {
    expect(
      findLastPerformance(history, { name: 'Squat', canonicalExerciseId: 'squat' }, 0),
    ).toBeNull()
    expect(findLastPerformance([], { name: 'Développé couché' }, 0)).toBeNull()
  })

  it('matche par nom si pas de canonical id', () => {
    const perf = findLastPerformance(history, { name: 'développé couché' }, 0)
    expect(perf?.weightKg).toBe(60)
  })

  it('peut exclure une note (édition historique)', () => {
    const perf = findLastPerformance(
      history,
      { name: 'Développé couché', canonicalExerciseId: 'bench_press' },
      0,
      { excludeNoteId: 'newer' },
    )
    expect(perf?.dateKey).toBe('2026-09-28')
    expect(perf?.weightKg).toBe(50)
  })

  it('n’expose pas Effort / rpe (jamais affiché)', () => {
    const perf = findLastPerformance(
      history,
      { name: 'Développé couché', canonicalExerciseId: 'bench_press' },
      0,
    )
    expect(perf).not.toHaveProperty('rpe')
  })
})

describe('pickSetForIndex', () => {
  it('ignore une série vide à l’index et retombe sur la dernière utilisable', () => {
    const sets: WorkoutSet[] = [
      { reps: 8, weightKg: 40 },
      { reps: 0, weightKg: 0 },
    ]
    expect(pickSetForIndex(sets, 1)).toEqual({
      set: sets[0],
      sourceSetIndex: 0,
    })
  })
})

describe('exerciseMatches', () => {
  it('privilégie canonicalExerciseId quand les deux côtés l’ont', () => {
    expect(
      exerciseMatches(
        { name: 'Autre titre', canonicalExerciseId: 'bench_press' },
        { name: 'Bench', canonicalExerciseId: 'bench_press' },
      ),
    ).toBe(true)
    expect(
      exerciseMatches(
        { name: 'Bench', canonicalExerciseId: 'bench_press' },
        { name: 'Bench', canonicalExerciseId: 'incline_bench' },
      ),
    ).toBe(false)
  })
})

describe('placeholders + copy-to-fields', () => {
  const perf = {
    weightKg: 60,
    reps: 8,
    dateKey: '2026-10-05',
    sourceSetIndex: 0,
  }

  it('placeholders gris : chiffres seuls, sans Effort / RPE', () => {
    expect(formatLastWeightPlaceholder(perf.weightKg)).toBe('60')
    expect(formatLastRepsPlaceholder(perf.reps)).toBe('8')
    expect(formatLastWeightPlaceholder(82.5)).toBe('82.5')
  })

  it('aria-labels accessibles sur champs vides', () => {
    expect(formatLastWeightAriaLabel(60)).toBe('kg, la dernière fois 60')
    expect(formatLastRepsAriaLabel(8)).toBe('reps, la dernière fois 8')
  })

  it('copy-to-fields : poids + reps uniquement (pas Effort)', () => {
    expect(lastPerformanceToSetPatch(perf)).toEqual({ weightKg: 60, reps: 8 })
    expect(lastPerformanceToSetPatch(perf)).not.toHaveProperty('rpe')
  })

  it('isSetLoadBlank : série 0/0 vide, sinon non', () => {
    expect(isSetLoadBlank({ weightKg: 0, reps: 0 })).toBe(true)
    expect(isSetLoadBlank({ weightKg: 60, reps: 0 })).toBe(false)
    expect(isSetLoadBlank({ weightKg: 0, reps: 8 })).toBe(false)
    expect(isSetLoadBlank({ weightKg: 0, reps: 0, done: true })).toBe(false)
  })
})

describe('nextSetFromPrevious — préremplissage + série', () => {
  it('copie poids et reps de la série précédente', () => {
    expect(nextSetFromPrevious({ reps: 6, weightKg: 80, done: true, rpe: 9 })).toEqual({
      reps: 6,
      weightKg: 80,
    })
  })

  it('fallback défaut si aucune série précédente', () => {
    expect(nextSetFromPrevious(undefined)).toEqual({ reps: 8, weightKg: 20 })
  })
})
