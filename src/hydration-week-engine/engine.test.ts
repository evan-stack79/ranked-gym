import { describe, expect, it } from 'vitest'
import {
  countsAsWater,
  detectHydrationEtat,
  drinkRepereRange,
  estimatedTotalWaterRange,
  isCaffeinated,
} from './engine.ts'
import {
  ALL_ETAT_FIXTURES,
  FIXTURE_ETAT_3_HIDDEN,
  FIXTURE_ETAT_4_COUNTING,
  FIXTURE_ETAT_7_FIVE_COFFEES,
  FIXTURE_ETAT_7_MINOR,
  FIXTURE_ETAT_10_TO_3,
  FIXTURE_PRIORITY_5_BLOCKS_DRINK_MORE,
  FIXTURE_PRIORITY_7_MINOR_OVER_6,
  FIXTURE_TOO_FEW_DAYS,
} from './fixtures.ts'
import { AIDE_02, AIDE_05, ETAT_TEXTES, ETAT_TITLES } from './texts.ts'

describe('countsAsWater', () => {
  it('accepte eau, eau gazeuse, infusion, eau citron et proches', () => {
    expect(countsAsWater('eau')).toBe(true)
    expect(countsAsWater('eau_gazeuse')).toBe(true)
    expect(countsAsWater('eau_petillante')).toBe(true)
    expect(countsAsWater('infusion')).toBe(true)
    expect(countsAsWater('eau_citron')).toBe(true)
    expect(countsAsWater('tisane')).toBe(true)
    expect(countsAsWater('cafe')).toBe(false)
    expect(countsAsWater('soda')).toBe(false)
  })
})

describe('drinkRepereRange', () => {
  it('EFSA 14+ hommes / femmes', () => {
    expect(drinkRepereRange(30, 'male')).toEqual({
      lowL: 1.75,
      highL: 2.0,
      label: 'environ 1,75 à 2,0 L de boissons (repère)',
    })
    expect(drinkRepereRange(30, 'female')).toEqual({
      lowL: 1.4,
      highL: 1.6,
      label: 'environ 1,4 à 1,6 L de boissons (repère)',
    })
  })

  it('65+ au moins 2,0 / 1,6', () => {
    expect(drinkRepereRange(70, 'homme')).toMatchObject({ lowL: 2.0, highL: 2.0 })
    expect(drinkRepereRange(70, 'femme')).toMatchObject({ lowL: 1.6, highL: 1.6 })
  })
})

describe('estimatedTotalWaterRange', () => {
  it('applique le facteur aliments 0,25–0,43', () => {
    const r = estimatedTotalWaterRange(1.5)
    expect(r.lowL).toBe(1.9) // 1.5 * 1.25
    expect(r.highL).toBe(2.1) // 1.5 * 1.43 → 2.145 → 2.1
    expect(r.label).toContain('1,9')
    expect(r.label).toContain('2,1')
  })
})

describe('detectHydrationEtat — chaque état 1–10', () => {
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
    it(`fixture état ${id} → id ${id}`, () => {
      const result = detectHydrationEtat(ALL_ETAT_FIXTURES[id]!)
      expect(result.id).toBe(id)
      expect(result.title).toBe(ETAT_TITLES[id])
      expect(result.texte).toBe(ETAT_TEXTES[id])
      expect(result.actions.length).toBeGreaterThan(0)
    })
  }
})

describe('textes aide (option A)', () => {
  it('aide 02 exacte', () => {
    const r = detectHydrationEtat(ALL_ETAT_FIXTURES[2]!)
    expect(r.aide).toBe(AIDE_02)
    expect(r.aide).toBe('Si on t’a donné une limite pour boire, c’est elle qui compte.')
  })

  it('aide 05 exacte', () => {
    const r = detectHydrationEtat(ALL_ETAT_FIXTURES[5]!)
    expect(r.aide).toBe(AIDE_05)
    expect(r.aide).toBe(
      'Boire bien plus que sa soif n’aide pas ; si tu te sens mal après avoir beaucoup bu, un pro de santé peut aider.',
    )
  })
})

describe('priorité C', () => {
  it('état 5 bloque les conseils « boire plus » (1 / 9)', () => {
    const r = detectHydrationEtat(FIXTURE_PRIORITY_5_BLOCKS_DRINK_MORE)
    expect(r.id).toBe(5)
    expect(r.blocksDrinkMore).toBe(true)
  })

  it('7-minor avant 6', () => {
    const r = detectHydrationEtat(FIXTURE_PRIORITY_7_MINOR_OVER_6)
    expect(r.id).toBe(7)
    expect(r.variant).toBe('minor')
    expect(r.neverSuggestCaffeinated).toBe(true)
  })

  it('<4 jours saisis → aucun état semaine', () => {
    const r = detectHydrationEtat(FIXTURE_TOO_FEW_DAYS)
    expect(r.id).toBe(0)
  })

  it('état 10 → 3 après 14 jours sans saisie', () => {
    expect(detectHydrationEtat(ALL_ETAT_FIXTURES[10]!).id).toBe(10)
    expect(detectHydrationEtat(FIXTURE_ETAT_10_TO_3).id).toBe(3)
  })
})

describe('état 7 variants', () => {
  it('adulte', () => {
    const r = detectHydrationEtat(ALL_ETAT_FIXTURES[7]!)
    expect(r.id).toBe(7)
    expect(r.variant).toBe('adult')
    expect(r.neverSuggestCaffeinated).toBe(false)
  })

  it('mineur — jamais de boisson caféinée suggérée', () => {
    const r = detectHydrationEtat(FIXTURE_ETAT_7_MINOR)
    expect(r.id).toBe(7)
    expect(r.variant).toBe('minor')
    expect(r.neverSuggestCaffeinated).toBe(true)
    expect(r.actions.some((a) => /jamais de boisson caféinée/i.test(a))).toBe(true)
  })

  it('déclenche aussi sur 5 boissons caféinées (comptage boissons, pas mg)', () => {
    const r = detectHydrationEtat(FIXTURE_ETAT_7_FIVE_COFFEES)
    expect(r.id).toBe(7)
    expect(isCaffeinated('cafe')).toBe(true)
  })
})

describe('autres déclencheurs', () => {
  it('état 3 via module masqué', () => {
    expect(detectHydrationEtat(FIXTURE_ETAT_3_HIDDEN).id).toBe(3)
  })

  it('état 4 via médiane ≥12 saisies + Q', () => {
    expect(detectHydrationEtat(FIXTURE_ETAT_4_COUNTING).id).toBe(4)
  })
})
