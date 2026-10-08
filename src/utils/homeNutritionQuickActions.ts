import { addWaterEntry, getTodayWaterMl } from '../services/nutritionStorage'
import { getNutritionTarget } from '../services/nutritionActivity'

/** Même quantité que le preset « Verre » de SmartWaterGauge. */
export const HOME_QUICK_WATER_ML = 250

/**
 * Quick-add water stays available without a daily goal.
 * Goal progress is optional UX; logging water must always work.
 */
export function shouldShowHomeQuickWaterButton(
  _consumedMl?: number,
  _goalMl?: number | null,
): boolean {
  return true
}

export function canSubmitHomeQuickWater(isSaving: boolean): boolean {
  return !isSaving
}

export type HomeQuickWaterResult =
  | { ok: true; waterMl: number; addedMl: number }
  | { ok: false; message: string }

/**
 * Ajoute 250 ml via le chemin officiel (`addWaterEntry`, type `glass`).
 * Ne modifie ni target calorique ni macros.
 */
export function tryAddHomeQuickWater(): HomeQuickWaterResult {
  try {
    const before = getTodayWaterMl()
    const result = addWaterEntry({
      amountMl: HOME_QUICK_WATER_ML,
      type: 'glass',
      label: 'Verre',
    })
    return {
      ok: true,
      waterMl: result.waterMl,
      addedMl: result.waterMl - before,
    }
  } catch {
    return { ok: false, message: "Impossible d'ajouter l'eau" }
  }
}

/** Vérifie que l’ajout d’eau ne touche pas au target Nutrition Engine. */
export function readNutritionTargetCalories(): number {
  return getNutritionTarget().targetCalories
}
