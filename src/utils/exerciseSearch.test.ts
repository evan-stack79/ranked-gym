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

  it('alias tirage dos → tirage vertical', () => {
    const results = searchExercises('tirage dos')
    expect(results.some((e) => e.id === 'lat_pulldown')).toBe(true)
  })

  it('alias jambes machine → presse à cuisses', () => {
    const results = searchExercises('jambes machine')
    expect(results[0]?.id).toBe('leg_press')
  })

  it('nouveaux exercices wave2 trouvables (goblet, fente bulgare, arnold)', () => {
    expect(searchExercises('goblet').some((e) => e.id === 'goblet_squat')).toBe(true)
    expect(searchExercises('fente bulgare').some((e) => e.id === 'bulgarian_split_squat')).toBe(
      true,
    )
    expect(searchExercises('arnold').some((e) => e.id === 'arnold_press')).toBe(true)
    expect(EXERCISE_CATALOG.some((c) => c.id === 'kettlebell_swing')).toBe(true)
  })

  it('nouveaux exercices wave3 trouvables (sumo, chin-up, roulette)', () => {
    expect(searchExercises('sumo').some((e) => e.id === 'sumo_deadlift')).toBe(true)
    expect(searchExercises('supination').some((e) => e.id === 'chin_up')).toBe(true)
    expect(searchExercises('roulette').some((e) => e.id === 'ab_wheel')).toBe(true)
    expect(searchExercises('fente arrière').some((e) => e.id === 'reverse_lunge')).toBe(true)
  })

  it('nouveaux exercices wave4 trouvables (pupitre, box squat, pendlay)', () => {
    expect(searchExercises('pupitre').some((e) => e.id === 'preacher_curl')).toBe(true)
    expect(searchExercises('box squat').some((e) => e.id === 'box_squat')).toBe(true)
    expect(searchExercises('pendlay').some((e) => e.id === 'pendlay_row')).toBe(true)
    expect(searchExercises('kickback').some((e) => e.id === 'cable_kickback')).toBe(true)
  })

  it('nouveaux exercices wave5 trouvables (hack squat, nordic, dragon flag)', () => {
    expect(searchExercises('hack squat').some((e) => e.id === 'hack_squat')).toBe(true)
    expect(searchExercises('nordic').some((e) => e.id === 'nordic_curl')).toBe(true)
    expect(searchExercises('dragon').some((e) => e.id === 'dragon_flag')).toBe(true)
    expect(searchExercises('t-bar').some((e) => e.id === 't_bar_row')).toBe(true)
    expect(searchExercises('haussements').some((e) => e.id === 'shrug')).toBe(true)
  })

  it('limite l’affichage initial à 8', () => {
    expect(searchExercises('').length).toBe(8)
    expect(countExerciseMatches('')).toBe(EXERCISE_CATALOG.length)
  })

  it('filtre le catalogue selon les sports du profil', () => {
    const cali = searchExercises('', { sportIds: ['calisthenics'], limit: 20 })
    expect(cali.length).toBeGreaterThan(0)
    expect(cali.every((ex) => ex.sportIds.includes('calisthenics'))).toBe(true)
    expect(searchExercises('', { sportIds: ['tennis'], limit: 8 }).length).toBe(8)
  })
})
