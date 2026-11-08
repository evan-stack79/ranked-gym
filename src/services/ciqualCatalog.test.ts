import { afterEach, describe, expect, it, vi } from 'vitest'
import { CIQUAL_SOURCE_ATTRIBUTION, findCiqualByExactName, listCiqualBaseFoods } from './ciqualCatalog'

vi.mock('../backend/ciqualFeatureFlag', () => ({
  isCiqualEnabled: vi.fn(() => true),
}))

import { isCiqualEnabled } from '../backend/ciqualFeatureFlag'

describe('ciqualCatalog — chiffres UE 1169 (sans réseau)', () => {
  afterEach(() => {
    vi.mocked(isCiqualEnabled).mockReturnValue(true)
  })

  it('flag OFF → liste vide', () => {
    vi.mocked(isCiqualEnabled).mockReturnValue(false)
    expect(listCiqualBaseFoods({ term: 'croissant' })).toEqual([])
  })

  it('valeurs validées (kcal/100 g)', () => {
    const cases: Array<[string, number]> = [
      ['Croissant, sans précision', 375],
      ['Pain, baguette, courante', 287],
      ['Riz blanc, cuit, non salé', 145],
      ['Banane, pulpe, crue', 90.5],
      ['Oeuf, dur', 134],
    ]
    for (const [nom, kcal] of cases) {
      const row = findCiqualByExactName(nom)
      expect(row, nom).toBeTruthy()
      expect(row!.calories).toBe(kcal)
      expect(row!.proteines).toBeNull()
      expect(row!.glucides).toBeNull()
      expect(row!.lipides).toBeNull()
      expect(row!.provenance).toBe('ciqual')
    }
  })

  it('pomme crue absente (pas de 0 kcal)', () => {
    expect(findCiqualByExactName('Pomme, pulpe et peau, crue')).toBeNull()
    const hits = listCiqualBaseFoods({ term: 'Pomme, pulpe et peau, crue', limit: 50 })
    expect(hits.every((h) => h.calories > 0)).toBe(true)
    expect(hits.some((h) => h.nom === 'Pomme, pulpe et peau, crue')).toBe(false)
  })

  it('recherche « croissant » priorise le nom exact', () => {
    const hits = listCiqualBaseFoods({ term: 'croissant', limit: 10 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.nom.toLowerCase()).toContain('croissant')
    expect(hits[0]!.calories).toBe(375)
  })

  it('mention source ANSES Ciqual 2020', () => {
    expect(CIQUAL_SOURCE_ATTRIBUTION).toBe('Source : ANSES, table Ciqual 2020')
  })
})
