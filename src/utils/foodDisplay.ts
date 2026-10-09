/**
 * Affichage des produits Open Food Facts (écran « Ajouter un aliment »).
 * Règles scientifiques : portion = serving_size OFF (ou « pour 100 g ») ;
 * le nettoyage du nom ne doit jamais modifier la portion.
 */

/** Portion par défaut quand serving_size OFF est absent — jamais inventée. */
export const DEFAULT_PORTION_LABEL = 'pour 100 g'

/**
 * Nettoie le nom produit pour l’UI :
 * - trim
 * - retire un poids/volume collé en fin (« 250g », « 33 cl », « 1,5L »)
 * - corrige le TOUT EN MAJUSCULES (title case fr léger)
 * Ne touche jamais à la portion / serving_size.
 */
export function cleanupFoodName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return name

  // Poids / volume en suffixe, éventuellement entre parenthèses.
  name = name
    .replace(
      /\s*[(\[]?\s*\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|cl|ml|L|CL|ML|G|KG)\s*[)\]]?\s*$/u,
      '',
    )
    .trim()

  if (isAllCapsWordy(name)) {
    name = softTitleCaseFr(name)
  }
  return name
}

function isAllCapsWordy(value: string): boolean {
  const letters = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/gu, '')
  if (letters.length < 3) return false
  return letters === letters.toUpperCase()
}

function softTitleCaseFr(value: string): string {
  return value
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s\-/'’])(\S)/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR'))
}

/**
 * Formate serving_size OFF → libellé UI.
 * - « serving » / « Serving » → « portion »
 * - espace avant les unités (g, ml, cl, kg, l)
 * - absent / vide → « pour 100 g »
 * Ne lit / ne modifie jamais le nom produit.
 */
export function formatOffServingSize(servingSize: string | null | undefined): string {
  const raw = typeof servingSize === 'string' ? servingSize.trim() : ''
  if (!raw) return DEFAULT_PORTION_LABEL

  let formatted = raw
    .replace(/\bservings\b/gi, 'portions')
    .replace(/\bserving\b/gi, 'portion')
  // Espace avant unités collées : 30g → 30 g, 250ml → 250 ml
  formatted = formatted.replace(
    /(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml)\b/gi,
    (_, num: string, unit: string) => `${num} ${unit.toLowerCase()}`,
  )
  formatted = formatted.replace(/\s+/g, ' ').trim()
  return formatted || DEFAULT_PORTION_LABEL
}

/**
 * Tente d’extraire des grammes depuis un serving_size déjà formaté ou brut.
 * Retourne null si ambigu (pièces, ml sans densité, etc.) — on n’invente pas.
 */
export function parseGramsFromServingSize(servingSize: string | null | undefined): number | null {
  const raw = typeof servingSize === 'string' ? servingSize.trim() : ''
  if (!raw) return null
  const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  if (kg) {
    const n = Number.parseFloat(kg[1]!.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null
  }
  const g = raw.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
  if (g) {
    const n = Number.parseFloat(g[1]!.replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
  }
  return null
}

/** Scale per-100g nutrients to a portion in grams. Null stays null (never invent). */
export function scaleNutrientPer100g(
  per100g: number | null | undefined,
  grams: number,
  precision = 1,
): number | null {
  if (per100g == null || !Number.isFinite(per100g)) return null
  if (!Number.isFinite(grams) || grams <= 0) return null
  const scaled = (per100g * grams) / 100
  if (precision === 0) return Math.round(scaled)
  const factor = precision === 1 ? 10 : 100
  return Math.round(scaled * factor) / factor
}
