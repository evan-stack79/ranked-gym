/**
 * V3-01 — client et serveur partagent computeMealNutritionFromOffCache.
 * Aliment type Nutella 539 kcal/100 g : 30 g / 100 g / 250 g.
 */
import { describe, expect, it } from 'vitest'
import { computeMealNutritionFromOffCache } from '../../convex/lib/foodAddNutrients'
import {
  computeLocalMealNutritionFromOffHit,
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

const CASES: Array<{ grams: number; calories: number; proteinG: number; carbsG: number; fatG: number }> =
  [
    { grams: 30, calories: 162, proteinG: 1.9, carbsG: 17.3, fatG: 9.3 },
    { grams: 100, calories: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 },
    { grams: 250, calories: 1348, proteinG: 15.8, carbsG: 143.8, fatG: 77.3 },
  ]

describe('V3-01 — échelle client = serveur (Nutella-like 539 kcal/100 g)', () => {
  for (const c of CASES) {
    it(`${c.grams} g → ${c.calories} kcal + macros (égal serveur)`, () => {
      const client = computeLocalMealNutritionFromOffHit(NUTELLA_HIT, { grams: c.grams })
      const server = computeMealNutritionFromOffCache(offHitToNutrientCache(NUTELLA_HIT), {
        grams: c.grams,
      })

      expect(client).toEqual(server)
      expect(client.calories).toBe(c.calories)
      expect(client.proteinG).toBe(c.proteinG)
      expect(client.carbsG).toBe(c.carbsG)
      expect(client.fatG).toBe(c.fatG)
      // Ne jamais coller la valeur /100 g quand grams ≠ 100.
      if (c.grams !== 100) {
        expect(client.calories).not.toBe(539)
      }
    })
  }

  it('nutriment per100g null → null (jamais 0)', () => {
    const hit: OffHitLike = {
      nom: 'Sans kcal',
      calories: null,
      proteines: null,
      glucides: null,
      lipides: null,
    }
    const client = computeLocalMealNutritionFromOffHit(hit, { grams: 30 })
    expect(client).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })
})
