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

function parseLocaleNumber(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

/**
 * Libellé pièces V3 — virgule décimale, pluriel seulement à partir de 2.
 * « 0,5 pièce », « 1 pièce », « 1,5 pièce », « 2 pièces ».
 */
export function formatPiecesCountLabel(pieces: number): string {
  const n = pieces
  const label = Number.isInteger(n)
    ? String(n)
    : n.toFixed(1).replace(/\.0$/, '').replace('.', ',')
  return n >= 2 ? `${label} pièces` : `${label} pièce`
}

/** Libellé grams serveur / V3. */
export function formatGramsCountLabel(grams: number): string {
  const label = Number.isInteger(grams)
    ? String(grams)
    : grams.toFixed(1).replace(/\.0$/, '')
  return `${label} g`
}

export type ParsedPortionGrams = {
  /** Poids d’une pièce (ex. 25 dans « 2 x 25 g (50 g) »). */
  pieceGrams: number | null
  /** Poids de la portion entière (ex. 50). */
  servingGrams: number | null
}

/**
 * Parse serving_size OFF — source unique app + serveur (B111-14).
 * « 2 x 25 g (50 g) » → piece 25 / serving 50 ; si 2×25 ≠ 50 → null.
 * ml seul → null ; « 250 ml (240 g) » → serving 240.
 */
export function parsePortionGrams(
  servingSize: string | null | undefined,
): ParsedPortionGrams {
  const raw = typeof servingSize === 'string' ? servingSize.trim() : ''
  if (!raw) return { pieceGrams: null, servingGrams: null }

  const hasVolume = /\d+(?:[.,]\d+)?\s*(ml|cl|l)\b/i.test(raw)
  const hasExplicitGrams = /\d+(?:[.,]\d+)?\s*(kg|g)\b/i.test(raw)
  if (hasVolume && !hasExplicitGrams) {
    return { pieceGrams: null, servingGrams: null }
  }

  // « 2 x 25 g (50 g) » / « 2 × 25g (50g) »
  const multi = raw.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*g\b(?:\s*\((\d+(?:[.,]\d+)?)\s*g\))?/i,
  )
  if (multi) {
    const count = parseLocaleNumber(multi[1]!)
    const piece = parseLocaleNumber(multi[2]!)
    if (!Number.isFinite(count) || !Number.isFinite(piece) || count <= 0 || piece <= 0) {
      return { pieceGrams: null, servingGrams: null }
    }
    if (multi[3] != null) {
      const total = parseLocaleNumber(multi[3])
      if (!Number.isFinite(total) || total <= 0) {
        return { pieceGrams: null, servingGrams: null }
      }
      // Tolérance flottante : 2×25 doit égaler 50.
      if (Math.abs(count * piece - total) > 0.05) {
        return { pieceGrams: null, servingGrams: null }
      }
      return {
        pieceGrams: Math.round(piece * 10) / 10,
        servingGrams: Math.round(total * 10) / 10,
      }
    }
    return {
      pieceGrams: Math.round(piece * 10) / 10,
      servingGrams: Math.round(count * piece * 10) / 10,
    }
  }

  const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  if (kg) {
    const n = parseLocaleNumber(kg[1]!)
    if (!Number.isFinite(n) || n <= 0) return { pieceGrams: null, servingGrams: null }
    return { pieceGrams: null, servingGrams: Math.round(n * 1000) }
  }

  // Dernière mention « g » (souvent « 250 ml (240 g) »).
  const gMatches = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)]
  const g = gMatches.length > 0 ? gMatches[gMatches.length - 1] : null
  if (g) {
    const n = parseLocaleNumber(g[1]!)
    if (!Number.isFinite(n) || n <= 0) return { pieceGrams: null, servingGrams: null }
    return { pieceGrams: null, servingGrams: Math.round(n * 10) / 10 }
  }

  return { pieceGrams: null, servingGrams: null }
}

/** Poids à utiliser pour 1 pièce (ou portion unitaire) — pieceGrams prioritaire. */
export function resolveUnitGramsForPieces(
  servingSize: string | null | undefined,
): number | null {
  const parsed = parsePortionGrams(servingSize)
  return parsed.pieceGrams ?? parsed.servingGrams
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
