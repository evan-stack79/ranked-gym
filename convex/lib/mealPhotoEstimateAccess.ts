/**
 * V3-07 / V3-08 / V3-09 — garde + limites Photo IA (serveur).
 * Pure : testable sans réseau / sans clés Gemini.
 *
 * Aligné client `canUseMealPhotoEstimate` / `isMinorOrUnknownAge` :
 * mineur, âge inconnu, grossesse ou allaitement → refuse (0 kcal).
 */
import {
  extractStoredNutritionAge,
  NUTRITION_ADULT_MIN,
} from './nutritionProfile'

/** Même plafond UI que EditMealSheet / ScannedProductSheet / saisie manuelle. */
export const MAX_MEAL_PHOTO_KCAL = 5000 as const

export const MEAL_PHOTO_ESTIMATE_BLOCKED = 'PHOTO_ESTIMATE_BLOCKED' as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Homme : flags grossesse/allaitement obsolètes ignorés (comme le client). */
export function effectivePregnancyBreastfeedingFromProfileJson(
  profileJson: unknown,
): { pregnancy: boolean; breastfeeding: boolean } {
  const rec = asRecord(profileJson)
  if (!rec) return { pregnancy: false, breastfeeding: false }
  if (rec.sex === 'male') return { pregnancy: false, breastfeeding: false }
  return {
    pregnancy: Boolean(rec.declaredPregnancy),
    breastfeeding: Boolean(rec.declaredBreastfeeding),
  }
}

/**
 * V3-07 — true seulement si âge stocké ≥18 et hors grossesse/allaitement.
 * Âge manquant / invalide → false (fail-closed, comme isMinorOrUnknownAge).
 */
export function canUseMealPhotoEstimateFromProfileJson(profileJson: unknown): boolean {
  const age = extractStoredNutritionAge(profileJson)
  if (age == null || age < NUTRITION_ADULT_MIN) return false
  const pb = effectivePregnancyBreastfeedingFromProfileJson(profileJson)
  if (pb.pregnancy || pb.breastfeeding) return false
  return true
}

export function clampMealPhotoCalories(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(MAX_MEAL_PHOTO_KCAL, Math.max(0, Math.round(n)))
}

/** V3-08 — validation confirm Photo IA (UI + serveur). */
export function validateMealPhotoConfirmCalories(
  value: unknown,
): { ok: true; calories: number } | { ok: false; reason: 'above_max' | 'invalid' } {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid' }
  if (n > MAX_MEAL_PHOTO_KCAL) return { ok: false, reason: 'above_max' }
  return { ok: true, calories: Math.round(n) }
}

/**
 * V3-09 — macros proportionnelles à l’édition des kcal
 * (ratio = next / base ; base=0 → macros à 0).
 */
export function scaleMealPhotoMacrosForEditedKcal(input: {
  baseCalories: number
  baseProteinG: number
  baseCarbsG: number
  baseFatG: number
  nextCalories: number
}): {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
} {
  const calories = clampMealPhotoCalories(input.nextCalories)
  const base = input.baseCalories
  if (!(base > 0) || !Number.isFinite(base)) {
    return { calories, proteinG: 0, carbsG: 0, fatG: 0 }
  }
  const ratio = calories / base
  const scaleMacro = (v: number): number => {
    if (!Number.isFinite(v)) return 0
    return Math.round(v * ratio * 10) / 10
  }
  return {
    calories,
    proteinG: scaleMacro(input.baseProteinG),
    carbsG: scaleMacro(input.baseCarbsG),
    fatG: scaleMacro(input.baseFatG),
  }
}
