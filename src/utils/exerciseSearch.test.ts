import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from '../data/exerciseCatalog'
import {
  countExerciseMatches,
  normalizeSearchText,
  searchExercises,
} from './exerciseSearch'

describe('exerciseSearch', () => {
  it('ignore casse et accents', () => {
    expect(normalizeSearchText('Développé')).toBe('developpe')
    const accented = searchExercises('développé')
    const plain = searchExercises('DEVELOPPE')
    expect(accented.map((e) => e.id)).toEqual(plain.map((e) => e.id))
  })

  it('retourne les développés réels du catalogue pour « développé »', () => {
    const results = searchExercises('développé', { limit: 8 })
    const names = results.map((e) => e.name)
    expect(names).toContain('Développé couché')
    expect(names).toContain('Développé incliné')
    expect(names).toContain('Développé militaire')
    expect(names).toContain('Développé couché haltères')
    // Pas une liste fantôme : chaque résultat est dans le catalogue.
    for (const r of results) {
      expect(EXERCISE_CATALOG.some((c) => c.id === r.id)).toBe(true)
    }
  })

  it('alias bench → développé couché en tête', () => {
    const results = searchExercises('bench')
    expect(results[0]?.id).toBe('bench_press')
  })

  it('alias pec → pectoraux (développé / écarté…)', () => {
    const results = searchExercises('pec')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((e) => e.muscles.some((m) => /pecto/i.test(m)))).toBe(true)
  })

  it('limite l’affichage initial à 8', () => {
    expect(searchExercises('').length).toBe(8)
    expect(countExerciseMatches('')).toBe(EXERCISE_CATALOG.length)
  })

  it('pertinence : match exact avant substring', () => {
    const results = searchExercises('squat')
    expect(results[0]?.id).toBe('back_squat')
  })
})
