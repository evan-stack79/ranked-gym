/**
 * Formes « publiques » V3 — name / quantité / unité (+ ids, timestamps).
 * Jamais de kcal / macros dans les réponses app-facing V3.
 * Le stockage serveur conserve les calories (voir addFoodSnapshot).
 */

export const FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS = [
  'calories',
  'kcal',
  'proteinG',
  'proteines',
  'carbsG',
  'glucides',
  'fatG',
  'lipides',
  'energy',
  'nutriments',
  'caloriesPer100g',
  'proteinPer100g',
  'carbsPer100g',
  'fatPer100g',
] as const

export type FoodAddV3ForbiddenKey = (typeof FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS)[number]

export type FoodAddV3PublicHit = {
  barcode: string
  nom: string
  brands: string
  servingSize: string | null
  portionLabel: string
  categoriesTags: string[]
  imageUrl?: string
  imageStorageId?: string
  provenance: 'open_food_facts'
  fetchedAt: number
}

export type FoodAddV3PublicMeal = {
  mealId: string
  dateKey?: string
  mealType?: string
  name?: string
  grams?: number
  pieces?: number
  portionLabel?: string
  imageUrl?: string
  imageStorageId?: string
  offCode?: string
  createdAt?: number
  updatedAt: number
  deletedAt?: number
}

export function formatPortionLabelFromServing(servingSize: string | null | undefined): string {
  const raw = typeof servingSize === 'string' ? servingSize.trim() : ''
  return raw || 'pour 100 g'
}

export function toFoodAddV3PublicHit(input: {
  barcode: string
  nom: string
  brands: string
  servingSize: string | null
  categoriesTags: string[]
  imageUrl?: string
  imageStorageId?: string
  provenance: 'open_food_facts'
  fetchedAt: number
}): FoodAddV3PublicHit {
  return {
    barcode: input.barcode,
    nom: input.nom,
    brands: input.brands,
    servingSize: input.servingSize,
    portionLabel: formatPortionLabelFromServing(input.servingSize),
    categoriesTags: input.categoriesTags,
    imageUrl: input.imageUrl,
    imageStorageId: input.imageStorageId,
    provenance: input.provenance,
    fetchedAt: input.fetchedAt,
  }
}

export function toFoodAddV3PublicMeal(row: {
  mealId: string
  dateKey?: string
  mealType?: string
  name?: string
  grams?: number
  pieces?: number
  portionLabel?: string
  imageUrl?: string
  imageStorageId?: string
  offCode?: string
  createdAt?: number
  updatedAt: number
  deletedAt?: number
}): FoodAddV3PublicMeal {
  return {
    mealId: row.mealId,
    dateKey: row.dateKey,
    mealType: row.mealType,
    name: row.name,
    grams: row.grams,
    pieces: row.pieces,
    portionLabel: row.portionLabel,
    imageUrl: row.imageUrl,
    imageStorageId: row.imageStorageId,
    offCode: row.offCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }
}

/** True si un objet (récursif léger) expose une clé nutritionnelle interdite. */
export function foodAddV3ResponseContainsForbiddenNutrition(value: unknown): boolean {
  const forbidden = new Set<string>(FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS)
  const walk = (node: unknown, depth: number): boolean => {
    if (node == null || depth > 8) return false
    if (Array.isArray(node)) return node.some((item) => walk(item, depth + 1))
    if (typeof node !== 'object') return false
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.has(key)) return true
      if (walk(child, depth + 1)) return true
    }
    return false
  }
  return walk(value, 0)
}
