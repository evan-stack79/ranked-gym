/**
 * Calcul client des kcal/macros à l’ajout V3 — même formule que le serveur
 * (`computeMealNutritionFromOffCache` dans convex/lib/foodAddNutrients.ts).
 * Ne jamais inventer 0 ; null reste null.
 */
import {
  computeMealNutritionFromOffCache,
  parseServingGrams,
  type MealNutritionComputed,
  type OffProductNutrientCache,
} from '../../convex/lib/foodAddNutrients'
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
