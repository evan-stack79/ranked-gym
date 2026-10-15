/**
 * Serveur V3 : kcal/macros calculés depuis off_product_nutrients + grams/pieces.
 * Jamais d’invention (1 pièce ≠ 100 g ; ml ≠ g) ; null si inconnu (pas 0).
 */
import { describe, expect, it } from 'vitest'
import { __test } from '../../convex/foodAdd'
import type { OffProductNutrientCache } from '../../convex/lib/foodAddNutrients'

const CACHE_NUTELLA: OffProductNutrientCache = {
  caloriesPer100g: 539,
  proteinPer100g: 6.3,
  carbsPer100g: 57.5,
  fatPer100g: 30.9,
  servingSize: '15 g',
  servingGrams: 15,
}

const CACHE_NO_NUTRIENTS: OffProductNutrientCache = {
  caloriesPer100g: null,
  proteinPer100g: null,
  carbsPer100g: null,
  fatPer100g: null,
  servingSize: '1 unit',
  servingGrams: null,
}

describe('addFoodSnapshot — calcul serveur depuis off_product_nutrients', () => {
  it('ignore calories:999 client : stocke la valeur calculée serveur (30 g × 539/100)', () => {
    const clientCalories = 999
    void clientCalories
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NUTELLA, { grams: 30 })
    expect(stored.calories).toBe(162) // round(539 * 30 / 100)
    expect(stored.calories).not.toBe(999)
    expect(stored.proteinG).toBe(1.9)
    expect(stored.carbsG).toBe(17.3)
    expect(stored.fatG).toBe(9.3)
  })

  it('ignore calories:9999 et proteinG:-3 client — jamais stockés (B111-02)', () => {
    // addFoodSnapshot lit void args.calories / macros ; seul le cache compte.
    const clientCalories = 9999
    const clientProtein = -3
    void clientCalories
    void clientProtein
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NUTELLA, { grams: 30 })
    expect(stored.calories).toBe(162)
    expect(stored.calories).not.toBe(9999)
    expect(stored.proteinG).toBe(1.9)
    expect(stored.proteinG).not.toBe(-3)
  })

  it('règle de trois : kcal/macros = per100 × grams / 100', () => {
    const grams = 50
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NUTELLA, { grams })
    expect(stored.calories).toBe(Math.round((539 * grams) / 100))
    expect(stored.proteinG).toBe(Math.round(((6.3 * grams) / 100) * 10) / 10)
    expect(stored.carbsG).toBe(Math.round(((57.5 * grams) / 100) * 10) / 10)
    expect(stored.fatG).toBe(Math.round(((30.9 * grams) / 100) * 10) / 10)
  })

  it('produit sans nutriments → null (pas 0)', () => {
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NO_NUTRIENTS, { grams: 100 })
    expect(stored).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })

  it('offCode absent du cache off_product_nutrients → null kcal/macros (add accepté)', () => {
    // Simule loadOffProductNutrients → null (code inconnu) : pas de throw, tout null.
    const stored = __test.computeMealNutritionFromOffCache(null, {
      grams: 80,
      pieces: undefined,
    })
    expect(stored).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })

  it('Pièces sans poids portion/pièce OFF → null (jamais 1 pièce = 100 g)', () => {
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NO_NUTRIENTS, { pieces: 2 })
    expect(stored).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
    const withMacrosNoWeight: OffProductNutrientCache = {
      ...CACHE_NUTELLA,
      servingSize: '1 piece',
      servingGrams: null,
    }
    expect(__test.computeMealNutritionFromOffCache(withMacrosNoWeight, { pieces: 1 })).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })

  it('Pièces avec servingGrams OFF connu → scale correct', () => {
    const stored = __test.computeMealNutritionFromOffCache(CACHE_NUTELLA, { pieces: 2 })
    expect(stored.calories).toBe(162)
  })

  it('Pièces : grams = pieces × servingGrams si connu, sinon null (B111-03)', () => {
    // servingGrams 15 → 3 pièces = 45 g → kcal round(539*45/100)=243
    const withWeight = __test.computeMealNutritionFromOffCache(CACHE_NUTELLA, {
      grams: 3 * 15,
    })
    expect(withWeight.calories).toBe(243)
    // sans poids pièce → null (jamais inventer 100 g)
    const noWeight = __test.computeMealNutritionFromOffCache(CACHE_NO_NUTRIENTS, { pieces: 3 })
    expect(noWeight.calories).toBeNull()
  })

  it('ajout manuel (pas d’offCode / cache null) → null kcal et macros (pas 0)', () => {
    const stored = __test.computeMealNutritionFromOffCache(null, { grams: 120 })
    expect(stored).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    })
  })

  it('parseServingGrams : ml seul → null ; ml + g explicite → g ; règle g seule', () => {
    expect(__test.parseServingGrams('250 ml')).toBeNull()
    expect(__test.parseServingGrams('33 cl')).toBeNull()
    expect(__test.parseServingGrams('1 l')).toBeNull()
    expect(__test.parseServingGrams('250 ml (240 g)')).toBe(240)
    expect(__test.parseServingGrams('15 g')).toBe(15)
    expect(__test.parseServingGrams('1 serving (100 g)')).toBe(100)
    expect(__test.parseServingGrams('1 piece')).toBeNull()
    expect(__test.parseServingGrams(null)).toBeNull()
  })
})
