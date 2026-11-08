/**
 * Calcul client des kcal/macros à l’ajout / édition V3 — même formule que le serveur
 * (`computeMealNutritionFromOffCache` dans convex/lib/foodAddNutrients.ts).
 * Ne jamais inventer 0 ; null reste null.
 */
import {
  computeMealNutritionFromOffCache,
  parseServingGrams,
  type MealNutritionComputed,
  type OffProductNutrientCache,
} from '../../convex/lib/foodAddNutrients'
import { findCachedFoodByOffCode } from '../services/foodOfflineCache'
import type { OffHitLike } from './foodJournalSnapshot'

export function offHitToNutrientCache(hit: OffHitLike): OffProductNutrientCache {
  return {
    caloriesPer100g: hit.calories,
    proteinPer100g: hit.proteines,
    carbsPer100g: hit.glucides,
    fatPer100g: hit.lipides,
    servingSize: hit.servingSize ?? null,
    servingGrams: parseServingGrams(hit.servingSize),
  }
}

/**
 * Mise à l’échelle locale (= serveur) pour la quantité choisie (g / pièces).
 */
export function computeLocalMealNutritionFromOffHit(
  hit: OffHitLike,
  quantity: { grams?: number | null; pieces?: number | null },
): MealNutritionComputed {
  return computeMealNutritionFromOffCache(offHitToNutrientCache(hit), quantity)
}

export type MealEditNutritionBaseline = {
  grams: number
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}

/**
 * Reconstruit un cache /100 g depuis les absolus stockés (fallback si offline miss).
 * Ne convertit jamais null → 0.
 */
export function baselineToNutrientCache(
  baseline: MealEditNutritionBaseline,
): OffProductNutrientCache | null {
  if (!(baseline.grams > 0) || !Number.isFinite(baseline.grams)) return null
  const toPer100 = (absolute: number | null): number | null => {
    if (absolute == null || !Number.isFinite(absolute)) return null
    return (absolute * 100) / baseline.grams
  }
  return {
    caloriesPer100g: toPer100(baseline.calories),
    proteinPer100g: toPer100(baseline.proteinG),
    carbsPer100g: toPer100(baseline.carbsG),
    fatPer100g: toPer100(baseline.fatG),
    servingSize: null,
    servingGrams: null,
  }
}

/**
 * Cache OFF pour une édition : offline (per-100 g vrai) puis baseline.
 */
export function resolveNutrientCacheForMealEdit(input: {
  offCode?: string | null
  baseline?: MealEditNutritionBaseline | null
}): OffProductNutrientCache | null {
  const cached = findCachedFoodByOffCode(input.offCode)
  if (
    cached &&
    (cached.calories != null ||
      cached.proteines != null ||
      cached.glucides != null ||
      cached.lipides != null)
  ) {
    return offHitToNutrientCache(cached)
  }
  if (input.baseline) return baselineToNutrientCache(input.baseline)
  return null
}

/**
 * Recalcule kcal/macros à la modification de quantité (V3) — même helper serveur.
 */
export function computeLocalMealNutritionForEdit(input: {
  offCode?: string | null
  grams?: number | null
  pieces?: number | null
  baseline?: MealEditNutritionBaseline | null
}): MealNutritionComputed {
  const cache = resolveNutrientCacheForMealEdit({
    offCode: input.offCode,
    baseline: input.baseline,
  })
  return computeMealNutritionFromOffCache(cache, {
    grams: input.grams,
    pieces: input.pieces,
  })
}
