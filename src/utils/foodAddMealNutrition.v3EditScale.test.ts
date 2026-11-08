/** @vitest-environment jsdom */
/**
 * V3-02 — édition quantité : client recalcule via computeMealNutritionFromOffCache
 * (même formule que le serveur à l’ajout). Nutella-like 539 kcal/100 g.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { computeMealNutritionFromOffCache } from '../../convex/lib/foodAddNutrients'
import {
  clearFoodOfflineCache,
  rememberFoodHits,
} from '../services/foodOfflineCache'
import {
  computeLocalMealNutritionForEdit,
  offHitToNutrientCache,
} from './foodAddMealNutrition'
import type { OffHitLike } from './foodJournalSnapshot'

/** 539 kcal / 6,3 P / 57,5 G / 30,9 L pour 100 g (Nutella-like). */
const NUTELLA_HIT: OffHitLike = {
  nom: 'Nutella',
  barcode: '3017620422003',
  calories: 539,
  proteines: 6.3,
  glucides: 57.5,
  lipides: 30.9,
  servingSize: '15 g',
}

const BASELINE_30 = {
  grams: 30,
  calories: 162,
  proteinG: 1.9,
  carbsG: 17.3,
  fatG: 9.3,
}

const EDIT_CASES: Array<{
  fromG: number
  toG: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}> = [
  {
    fromG: 30,
    toG: 100,
    calories: 539,
    proteinG: 6.3,
    carbsG: 57.5,
    fatG: 30.9,
  },
  {
    fromG: 30,
    toG: 250,
    calories: 1348,
    proteinG: 15.8,
    carbsG: 143.8,
    fatG: 77.3,
  },
]

describe('V3-02 — édition g : client = computeMealNutritionFromOffCache', () => {
  afterEach(() => {
    clearFoodOfflineCache()
  })

  for (const c of EDIT_CASES) {
    it(`${c.fromG}→${c.toG} g → ${c.calories} kcal + macros (cache OFF)`, () => {
      rememberFoodHits([
        {
          ...NUTELLA_HIT,
          barcode: NUTELLA_HIT.barcode!,
          brands: 'Ferrero',
          provenance: 'open_food_facts',
          fetchedAt: 1,
        },
      ])

      const client = computeLocalMealNutritionForEdit({
        offCode: NUTELLA_HIT.barcode,
        grams: c.toG,
        baseline: BASELINE_30,
      })
      const server = computeMealNutritionFromOffCache(offHitToNutrientCache(NUTELLA_HIT), {
        grams: c.toG,
      })

      expect(client).toEqual(server)
      expect(client.calories).toBe(c.calories)
      expect(client.proteinG).toBe(c.proteinG)
      expect(client.carbsG).toBe(c.carbsG)
      expect(client.fatG).toBe(c.fatG)
      // Pas le ratio arrondi depuis 162 (→ 540 / 1350).
      expect(client.calories).not.toBe(Math.round(162 * (c.toG / 30)))
    })
  }

  it('nutriment per100g null → null (jamais 0)', () => {
    rememberFoodHits([
      {
        nom: 'Sans kcal',
        barcode: '000',
        brands: '',
        calories: null,
        proteines: null,
        glucides: null,
        lipides: null,
        provenance: 'open_food_facts',
        fetchedAt: 1,
      },
    ])
    // Cache présent mais tout null → pas de fallback inventé ; baseline absente.
    const client = computeLocalMealNutritionForEdit({
      offCode: '000',
      grams: 100,
      baseline: null,
    })
    expect(client).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })

  it('vide (grams null) → tout null (jamais 0)', () => {
    const client = computeLocalMealNutritionForEdit({
      offCode: NUTELLA_HIT.barcode,
      grams: null,
      baseline: BASELINE_30,
    })
    expect(client).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })
})
