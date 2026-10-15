/**
 * Limites quantité « Ajouter un aliment » — source unique app + serveur.
 * grams : entier 1–2000 ; pieces : 0,5–50 par pas de 0,5 ;
 * en mode pièces avec servingGrams connu, total ≤ 2000 g.
 */

export const FOOD_ADD_QUANTITY_INVALID = 'FOOD_ADD_QUANTITY_INVALID' as const

export const FOOD_QTY_GRAMS_MIN = 1
export const FOOD_QTY_GRAMS_MAX = 2000
export const FOOD_QTY_PIECES_MIN = 0.5
export const FOOD_QTY_PIECES_MAX = 50
export const FOOD_QTY_PIECES_STEP = 0.5

export type FoodQuantityUnit = 'g' | 'pieces'

export type FoodQuantityFailReason = 'below_min' | 'above_max' | 'invalid'

export type FoodQuantityValidation =
  | { ok: true; unit: 'g'; grams: number }
  | { ok: true; unit: 'pieces'; pieces: number }
  | {
      ok: false
      code: typeof FOOD_ADD_QUANTITY_INVALID
      reason: FoodQuantityFailReason
      unit: FoodQuantityUnit
    }

/** Messages UI — word for word (jamais l’erreur brute). */
export const FOOD_ADD_QTY_MSG_BELOW_MIN = 'Entre une quantité plus grande que 0.' as const
export const FOOD_ADD_QTY_MSG_ABOVE_MAX = 'Vérifie ce chiffre, il semble trop grand.' as const
export const FOOD_ADD_QTY_MSG_INVALID_GRAMS = 'Entre un nombre entier de grammes.' as const
export const FOOD_ADD_QTY_MSG_INVALID_PIECES =
  'Utilise des demi-pièces : 0,5, 1, 1,5…' as const

export function foodAddQuantityUserMessage(
  reason: FoodQuantityFailReason,
  unit?: FoodQuantityUnit,
): string {
  if (reason === 'above_max') return FOOD_ADD_QTY_MSG_ABOVE_MAX
  if (reason === 'invalid') {
    if (unit === 'pieces') return FOOD_ADD_QTY_MSG_INVALID_PIECES
    return FOOD_ADD_QTY_MSG_INVALID_GRAMS
  }
  return FOOD_ADD_QTY_MSG_BELOW_MIN
}

function isHalfStep(n: number): boolean {
  return Math.abs(n * 2 - Math.round(n * 2)) < 1e-9
}

/**
 * Valide grams ou pièces. Champ vide → below_min (l’UI désactive Valider sans soumettre).
 */
export function validateFoodQuantity(input: {
  unit: FoodQuantityUnit
  value: number | '' | null | undefined
  /** Poids d’une pièce OFF (g) si connu — pour plafonner pieces × servingGrams. */
  servingGrams?: number | null
}): FoodQuantityValidation {
  const unit = input.unit
  if (input.value === '' || input.value == null) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min', unit }
  }
  const n = typeof input.value === 'number' ? input.value : Number(input.value)
  if (!Number.isFinite(n)) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'invalid', unit }
  }

  if (unit === 'g') {
    if (n <= 0) {
      return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min', unit }
    }
    if (!Number.isInteger(n)) {
      return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'invalid', unit }
    }
    if (n < FOOD_QTY_GRAMS_MIN) {
      return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min', unit }
    }
    if (n > FOOD_QTY_GRAMS_MAX) {
      return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'above_max', unit }
    }
    return { ok: true, unit: 'g', grams: n }
  }

  // pieces
  if (n <= 0) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min', unit }
  }
  if (!isHalfStep(n)) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'invalid', unit }
  }
  if (n < FOOD_QTY_PIECES_MIN) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min', unit }
  }
  if (n > FOOD_QTY_PIECES_MAX) {
    return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'above_max', unit }
  }
  const sg = input.servingGrams
  if (typeof sg === 'number' && Number.isFinite(sg) && sg > 0) {
    if (n * sg > FOOD_QTY_GRAMS_MAX) {
      return { ok: false, code: FOOD_ADD_QUANTITY_INVALID, reason: 'above_max', unit }
    }
  }
  return { ok: true, unit: 'pieces', pieces: n }
}
