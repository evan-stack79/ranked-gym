import type { MealEntry, MealType } from '../types/nutrition'
import {
  cleanupFoodName,
  formatOffServingSize,
  parseGramsFromServingSize,
  scaleNutrientPer100g,
} from './foodDisplay'

/** Champs nutritionnels figés au moment de l’ajout (pas un id OFF vivant). */
export interface FoodNutritionSnapshot {
  name: string
  portionLabel: string
  calories: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  grams?: number
  imageUrl?: string
  /** Conservé pour historique / debug — le journal n’en dépend pas pour recalculer. */
  barcode?: string
}

export interface OffHitLike {
  nom: string
  barcode?: string
  calories: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  imageUrl?: string
  servingSize?: string | null
}

/**
 * Construit un snapshot journal à partir d’un hit OFF du jour.
 * Name cleanup n’altère pas la portion. Nutrients figés (scalés si grammes connus).
 */
export function buildFoodNutritionSnapshot(hit: OffHitLike): FoodNutritionSnapshot {
  const portionLabel = formatOffServingSize(hit.servingSize)
  const grams = parseGramsFromServingSize(hit.servingSize)
  const name = cleanupFoodName(hit.nom)

  if (grams != null) {
    const calories = scaleNutrientPer100g(hit.calories, grams, 0)
    const proteinG = scaleNutrientPer100g(hit.proteines, grams)
    const carbsG = scaleNutrientPer100g(hit.glucides, grams)
    const fatG = scaleNutrientPer100g(hit.lipides, grams)
    return {
      name,
      portionLabel,
      calories: calories ?? 0,
      proteinG: proteinG ?? undefined,
      carbsG: carbsG ?? undefined,
      fatG: fatG ?? undefined,
      grams,
      imageUrl: hit.imageUrl,
      barcode: hit.barcode,
    }
  }

  return {
    name,
    portionLabel,
    calories: hit.calories == null ? 0 : Math.round(hit.calories),
    proteinG: hit.proteines ?? undefined,
    carbsG: hit.glucides ?? undefined,
    fatG: hit.lipides ?? undefined,
    imageUrl: hit.imageUrl,
    barcode: hit.barcode,
  }
}

/** Entrée journal : snapshot + horodatage propre (newest wins au sync). */
export function mealEntryFromSnapshot(
  snapshot: FoodNutritionSnapshot,
  mealType: MealType,
  now = Date.now(),
): Omit<MealEntry, 'id'> {
  return {
    name: snapshot.name,
    mealType,
    calories: snapshot.calories,
    proteinG: snapshot.proteinG,
    carbsG: snapshot.carbsG,
    fatG: snapshot.fatG,
    grams: snapshot.grams,
    portionLabel: snapshot.portionLabel,
    imageUrl: snapshot.imageUrl,
    createdAt: now,
    updatedAt: now,
  }
}
