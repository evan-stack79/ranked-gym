import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG, formatCatalogMeta, getCatalogExercise } from './exerciseCatalog'

describe('exerciseCatalog meta', () => {
  it('bench_press : muscles complets + équipement (même source picker / séance)', () => {
    const ex = getCatalogExercise('bench_press')!
    expect(formatCatalogMeta(ex)).toBe('Pectoraux · Triceps · Épaules · Barre')
  })

  it('catalogue = 30 exercices', () => {
    expect(EXERCISE_CATALOG).toHaveLength(30)
  })
})
