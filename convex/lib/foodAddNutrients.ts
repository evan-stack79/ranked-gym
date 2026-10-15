/**
 * Nutriments OFF côté serveur (cache par offCode) + calcul kcal/macros
 * à l’ajout — jamais de refetch OFF, jamais d’invention (1 pièce ≠ 100 g).
 */

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
 * Extrait des grammes depuis serving_size OFF.
 * ml / cl / l seuls → null (pas de densité inventée).
 * « 250 ml (240 g) » → 240 (gramme explicite).
 */
export function parseServingGrams(servingSize: string | null | undefined): number | null {
  const raw = typeof servingSize === 'string' ? servingSize.trim() : ''
  if (!raw) return null

  // Volume seul (ml/cl/l) sans grammes explicites → null.
  const hasVolume = /\d+(?:[.,]\d+)?\s*(ml|cl|l)\b/i.test(raw)
  const hasExplicitGrams = /\d+(?:[.,]\d+)?\s*(kg|g)\b/i.test(raw)
  if (hasVolume && !hasExplicitGrams) return null

  const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  if (kg) {
    const n = Number.parseFloat(kg[1]!.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null
  }
  // Si plusieurs mentions « g », prendre la dernière (souvent « 250 ml (240 g) »).
  const gMatches = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)]
  const g = gMatches.length > 0 ? gMatches[gMatches.length - 1] : null
  if (g) {
    const n = Number.parseFloat(g[1]!.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
  }
  return null
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
