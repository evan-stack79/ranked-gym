/**
 * Nutriments OFF côté serveur (cache par offCode) + calcul kcal/macros
 * à l’ajout — jamais de refetch OFF, jamais d’invention (1 pièce ≠ 100 g).
 */
import { parsePortionGrams } from './foodAddQuantity'

export type OffProductNutrientCache = {
  caloriesPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  servingSize: string | null
  /** Poids d’une portion/pièce OFF (g) si connu ; null sinon. */
  servingGrams: number | null
}

export type MealNutritionComputed = {
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}

/**
 * Extrait des grammes unitaires depuis serving_size OFF (source : parsePortionGrams).
 * Pièce prioritaire (« 2 x 25 g (50 g) » → 25) ; sinon portion ; ml seul → null.
 */
export function parseServingGrams(servingSize: string | null | undefined): number | null {
  const parsed = parsePortionGrams(servingSize)
  return parsed.pieceGrams ?? parsed.servingGrams
}

function scalePer100g(
  per100g: number | null | undefined,
  grams: number,
  precision: 0 | 1,
): number | null {
  if (per100g == null || !Number.isFinite(per100g)) return null
  if (!Number.isFinite(grams) || grams <= 0) return null
  const scaled = (per100g * grams) / 100
  if (precision === 0) return Math.round(scaled)
  return Math.round(scaled * 10) / 10
}

/**
 * Résout les grammes pour le calcul.
 * Pièces sans poids OFF connu → null (jamais 100 g inventés).
 */
export function resolveGramsForNutrition(input: {
  grams?: number | null
  pieces?: number | null
  servingGrams: number | null
}): number | null {
  if (typeof input.grams === 'number' && Number.isFinite(input.grams) && input.grams > 0) {
    return input.grams
  }
  if (typeof input.pieces === 'number' && Number.isFinite(input.pieces) && input.pieces > 0) {
    if (input.servingGrams == null || !(input.servingGrams > 0)) return null
    return input.pieces * input.servingGrams
  }
  return null
}

/**
 * Calcule kcal/macros depuis le cache serveur.
 * cache null (pas d’offCode / pas en cache) → tout null.
 * Nutriment per100g null → champ null (jamais 0 inventé).
 */
export function computeMealNutritionFromOffCache(
  cache: OffProductNutrientCache | null,
  quantity: { grams?: number | null; pieces?: number | null },
): MealNutritionComputed {
  if (!cache) {
    return { calories: null, proteinG: null, carbsG: null, fatG: null }
  }
  const grams = resolveGramsForNutrition({
    grams: quantity.grams,
    pieces: quantity.pieces,
    servingGrams: cache.servingGrams,
  })
  if (grams == null) {
    return { calories: null, proteinG: null, carbsG: null, fatG: null }
  }
  return {
    calories: scalePer100g(cache.caloriesPer100g, grams, 0),
    proteinG: scalePer100g(cache.proteinPer100g, grams, 1),
    carbsG: scalePer100g(cache.carbsPer100g, grams, 1),
    fatG: scalePer100g(cache.fatPer100g, grams, 1),
  }
}
