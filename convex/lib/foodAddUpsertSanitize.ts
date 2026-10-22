/**
 * Sanitize / coalesce pour upsertMeal (legacy vs V3) et upsertFoodSelection.
 * Legacy (sans quantityRules:'v3', ligne non-V3) : ne refuse jamais une quantité —
 * les valeurs invalides sont simplement omises.
 */

import {
  FOOD_ADD_QUANTITY_INVALID,
  formatGramsCountLabel,
  formatPiecesCountLabel,
  validateFoodQuantity,
  type FoodQuantityUnit,
} from './foodAddQuantity'

/** kcal/100 g au-delà de la graisse pure → null (900 encore OK). */
export const PER100G_KCAL_HARD_MAX = 900
/** Une macro > 100 g/100 g → null. */
export const PER100G_MACRO_HARD_MAX = 100

export type NutrientsSource = 'server' | 'client'

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Nutriment repas legacy : NaN / infini / négatif → null ; 0 et positifs gardés.
 * Ne jette jamais.
 */
export function sanitizeLegacyMealNutrient(
  value: number | null | undefined,
): number | null {
  if (value == null) return null
  if (!isFiniteNumber(value) || value < 0) return null
  return value
}

/**
 * Grammes/pièces legacy : stocke seulement si fini et > 0 ; sinon omis (undefined).
 * 0, négatif, NaN, infini → non enregistrés. Ne jette jamais.
 */
export function sanitizeLegacyQuantity(
  value: number | null | undefined,
): number | undefined {
  if (value == null) return undefined
  if (!isFiniteNumber(value) || !(value > 0)) return undefined
  return value
}

/**
 * Garde-fous physiques per-100g (upsertFoodSelection + catalogue).
 * >900 kcal → null ; macro >100 → null ; P+G+L >100 → les 3 à null.
 * Négatif / NaN → null. Ne jette jamais.
 */
export function sanitizePer100gNutrients(input: {
  caloriesPer100g: number | null | undefined
  proteinPer100g: number | null | undefined
  carbsPer100g: number | null | undefined
  fatPer100g: number | null | undefined
}): {
  caloriesPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
} {
  let caloriesPer100g: number | null = null
  if (isFiniteNumber(input.caloriesPer100g) && input.caloriesPer100g >= 0) {
    caloriesPer100g =
      input.caloriesPer100g > PER100G_KCAL_HARD_MAX ? null : input.caloriesPer100g
  }

  const sanitizeMacro = (v: number | null | undefined): number | null => {
    if (!isFiniteNumber(v) || v < 0) return null
    if (v > PER100G_MACRO_HARD_MAX) return null
    return v
  }

  let proteinPer100g = sanitizeMacro(input.proteinPer100g)
  let carbsPer100g = sanitizeMacro(input.carbsPer100g)
  let fatPer100g = sanitizeMacro(input.fatPer100g)

  const sum =
    (proteinPer100g ?? 0) + (carbsPer100g ?? 0) + (fatPer100g ?? 0)
  if (
    proteinPer100g != null &&
    carbsPer100g != null &&
    fatPer100g != null &&
    sum > PER100G_MACRO_HARD_MAX
  ) {
    proteinPer100g = null
    carbsPer100g = null
    fatPer100g = null
  }

  return { caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g }
}

/**
 * off_product_nutrients d’abord, sinon catalog (y compris vrai 0), sinon null.
 */
export function pickCatalogNutrient(
  fromOff: number | null | undefined,
  fromCatalog: number | null | undefined,
): number | null {
  if (typeof fromOff === 'number' && Number.isFinite(fromOff)) return fromOff
  if (typeof fromCatalog === 'number' && Number.isFinite(fromCatalog)) {
    return fromCatalog
  }
  return null
}

/** Catalogue nourrit V3 seulement si nutrientsSource === 'server'. */
export function catalogNutrientForV3Meal(
  fromOff: number | null | undefined,
  fromCatalog: number | null | undefined,
  nutrientsSource: NutrientsSource | string | null | undefined,
): number | null {
  if (typeof fromOff === 'number' && Number.isFinite(fromOff)) return fromOff
  if (nutrientsSource === 'server') {
    return pickCatalogNutrient(null, fromCatalog)
  }
  return null
}

export function isV3MealContext(input: {
  existingEntrySource?: string | null
  quantityRules?: 'v3' | string | null
}): boolean {
  return input.existingEntrySource === 'v3' || input.quantityRules === 'v3'
}

/**
 * Ignorer kcal/macros client : ligne déjà V3, ou création avec quantityRules:'v3'.
 * Une ligne ancienne existante garde les chiffres app même si quantityRules:'v3'.
 */
export function shouldIgnoreClientMealMacros(input: {
  existingEntrySource?: string | null
  hasExisting: boolean
  quantityRules?: 'v3' | string | null
}): boolean {
  if (input.existingEntrySource === 'v3') return true
  if (!input.hasExisting && input.quantityRules === 'v3') return true
  return false
}

/** Marque V3 posée seulement à la création (jamais sur une ligne existante). */
export function resolveEntrySourceOnUpsert(input: {
  existingEntrySource?: string | null
  hasExisting: boolean
  quantityRules?: 'v3' | string | null
}): 'v3' | undefined {
  if (input.hasExisting) {
    return input.existingEntrySource === 'v3' ? 'v3' : undefined
  }
  return input.quantityRules === 'v3' ? 'v3' : undefined
}

/** Proportion kcal (unité) / macros (dixième) quand les grammes changent. */
export function scaleNutritionOnGramsChange(input: {
  oldGrams: number
  newGrams: number
  calories: number | null | undefined
  proteinG: number | null | undefined
  carbsG: number | null | undefined
  fatG: number | null | undefined
}): {
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
} {
  const { oldGrams, newGrams } = input
  if (!(oldGrams > 0) || !(newGrams > 0) || !Number.isFinite(oldGrams) || !Number.isFinite(newGrams)) {
    return {
      calories: input.calories ?? null,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
    }
  }
  const ratio = newGrams / oldGrams
  const scaleKcal = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v)) return null
    return Math.round(v * ratio)
  }
  const scaleMacro = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v)) return null
    return Math.round(v * ratio * 10) / 10
  }
  return {
    calories: scaleKcal(input.calories),
    proteinG: scaleMacro(input.proteinG),
    carbsG: scaleMacro(input.carbsG),
    fatG: scaleMacro(input.fatG),
  }
}

export type UpsertMealQuantityResult =
  | {
      ok: true
      storeGrams: number | undefined
      storePieces: number | undefined
      portionLabel: string | undefined
      rewritePortionLabel: boolean
    }
  | {
      ok: false
      code: typeof FOOD_ADD_QUANTITY_INVALID
      reason: string
      unit: FoodQuantityUnit
    }

/**
 * Résout grams/pieces/portionLabel pour upsertMeal.
 * Refus / rewrite seulement si enforceQuantityRules (args.quantityRules === 'v3').
 * Sinon : jamais de throw — sanitize legacy (valeurs invalides omises).
 */
export function resolveUpsertMealQuantity(input: {
  /** Uniquement true quand l’appel envoie quantityRules:'v3'. */
  enforceQuantityRules: boolean
  grams?: number
  pieces?: number
  portionLabel?: string
}): UpsertMealQuantityResult {
  if (input.enforceQuantityRules) {
    const piecesPresent = input.pieces !== undefined
    const gramsPresent = input.grams !== undefined
    if (!piecesPresent && !gramsPresent) {
      return {
        ok: true,
        storeGrams: undefined,
        storePieces: undefined,
        portionLabel: input.portionLabel,
        rewritePortionLabel: false,
      }
    }
    const qty = validateFoodQuantity({
      unit: piecesPresent ? 'pieces' : 'g',
      value: piecesPresent ? input.pieces : input.grams,
    })
    if (!qty.ok) {
      return {
        ok: false,
        code: FOOD_ADD_QUANTITY_INVALID,
        reason: qty.reason,
        unit: qty.unit,
      }
    }
    if (qty.unit === 'pieces') {
      return {
        ok: true,
        storeGrams: undefined,
        storePieces: qty.pieces,
        portionLabel: formatPiecesCountLabel(qty.pieces),
        rewritePortionLabel: true,
      }
    }
    return {
      ok: true,
      storeGrams: qty.grams,
      storePieces: undefined,
      portionLabel: formatGramsCountLabel(qty.grams),
      rewritePortionLabel: true,
    }
  }

  // Sans quantityRules:'v3' : ne jamais refuser — omettre invalides.
  const storeGrams = sanitizeLegacyQuantity(input.grams)
  const storePieces = sanitizeLegacyQuantity(input.pieces)
  return {
    ok: true,
    storeGrams,
    storePieces,
    portionLabel: input.portionLabel,
    rewritePortionLabel: false,
  }
}

/**
 * Ligne V3 + appel SANS quantityRules + quantité qui échouerait V3 :
 * conserver grams/pieces/portionLabel déjà enregistrés (pas d’erreur).
 */
export function shouldKeepExistingV3Quantity(input: {
  existingEntrySource?: string | null
  enforceQuantityRules: boolean
  grams?: number
  pieces?: number
}): boolean {
  if (input.enforceQuantityRules) return false
  if (input.existingEntrySource !== 'v3') return false
  const piecesPresent = input.pieces !== undefined
  const gramsPresent = input.grams !== undefined
  if (!piecesPresent && !gramsPresent) return true
  const checked = validateFoodQuantity({
    unit: piecesPresent ? 'pieces' : 'g',
    value: piecesPresent ? input.pieces : input.grams,
  })
  return !checked.ok
}
