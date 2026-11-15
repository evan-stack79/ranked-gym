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
import {
  AIDE_02,
  AIDE_05,
  AIDE_07_ADULT,
  AIDE_07_MINOR,
  AIDE_07_PRIVACY,
  ETAT_TEXTES,
  ETAT_TITLES,
} from './texts.ts'

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
  it('EFSA 15–64 hommes / femmes', () => {
    expect(drinkRepereRange(30, 'male')).toEqual({
      lowL: 1.75,
      highL: 2.0,
      label: 'environ 1,75 à 2,0 L de boissons',
    })
    expect(drinkRepereRange(30, 'female')).toEqual({
      lowL: 1.4,
      highL: 1.6,
      label: 'environ 1,4 à 1,6 L de boissons',
    })
    expect(drinkRepereRange(15, 'male').label).toBe('environ 1,75 à 2,0 L de boissons')
  })

  it('65+ au moins 2,0 / 1,6', () => {
    expect(drinkRepereRange(70, 'homme')).toEqual({
      lowL: 2.0,
      highL: 2.0,
      label: 'au moins 2,0 L de boissons',
    })
    expect(drinkRepereRange(70, 'femme')).toEqual({
      lowL: 1.6,
      highL: 1.6,
      label: 'au moins 1,6 L de boissons',
    })
  })

  it('ne propose pas les plages 4–8 ni 9–13', () => {
    for (const age of [7, 10, 12, 14]) {
      const label = drinkRepereRange(age, 'male').label
      expect(label).not.toMatch(/1,1 à 1,3/)
      expect(label).not.toMatch(/1,5 à 1,7/)
      expect(label).not.toMatch(/1,3 à 1,5/)
    }
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

describe('titres courts choix B', () => {
  it('Bois plus tôt / Une bouteille = un tap', () => {
    expect(ETAT_TITLES[6]).toBe('Bois plus tôt')
    expect(ETAT_TITLES[10]).toBe('Une bouteille = un tap')
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
    expect(r.aide).toBe('Boire bien plus que sa soif n’aide pas. Écoute ta soif.')
  })

  it('privacy eau : compte, pas téléphone', () => {
    expect(AIDE_07_PRIVACY).toBe(
      'Personne d’autre ne voit ces données. Ton eau est sauvée sur ton compte.',
    )
    expect(AIDE_07_PRIVACY).not.toMatch(/téléphone/)
  })

  it('aide 07 adulte ≠ mineur (pas de café/thé proposés aux mineurs)', () => {
    expect(AIDE_07_ADULT).toBe(
      'Café, soda et jus : dans ton eau totale. Thé, eau gazeuse, infusion et eau au citron : aussi dans l’eau bue.',
    )
    expect(AIDE_07_MINOR).toBe(
      'Soda et jus apportent bien de l’eau. Ils comptent dans ton eau totale, et l’eau gazeuse au citron compte dans ton eau bue.',
    )
    expect(AIDE_07_MINOR).not.toMatch(/Café/)
    expect(AIDE_07_MINOR).not.toMatch(/Thé/)
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
    expect(r.actions).toContain(
      'Une fois par jour, remplace une boisson par de l’eau pétillante, une infusion ou de l’eau au citron. Jamais de boisson caféinée proposée.',
    )
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
