/** Catégories neutres de la roue « Ajouter un aliment » + tags OFF. */

export type FoodCategoryId =
  | 'all'
  | 'fruits'
  | 'drinks'
  | 'meals'
  | 'snacks'
  | 'dairy'

export interface FoodCategory {
  id: FoodCategoryId
  label: string
  /** Tags Open Food Facts (categories_tags) — matching souple. */
  offTags: string[]
}

export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  { id: 'all', label: 'Tout', offTags: [] },
  {
    id: 'fruits',
    label: 'Fruits',
    offTags: ['en:fruits', 'en:fresh-fruits', 'en:dried-fruits', 'fr:fruits'],
  },
  {
    id: 'drinks',
    label: 'Boissons',
    offTags: ['en:beverages', 'en:drinks', 'en:waters', 'en:sodas', 'fr:boissons'],
  },
  {
    id: 'meals',
    label: 'Repas',
    offTags: ['en:meals', 'en:prepared-meals', 'en:one-dish-meals', 'fr:plats-prepares'],
  },
  {
    id: 'snacks',
    label: 'Snacks',
    offTags: ['en:snacks', 'en:salty-snacks', 'en:sweet-snacks', 'fr:snacks'],
  },
  {
    id: 'dairy',
    label: 'Laitages',
    offTags: [
      'en:dairies',
      'en:dairy',
      'en:milks',
      'en:yogurts',
      'en:cheeses',
      'fr:produits-laitiers',
    ],
  },
] as const

export function foodCategoryById(id: FoodCategoryId): FoodCategory {
  return FOOD_CATEGORIES.find((c) => c.id === id) ?? FOOD_CATEGORIES[0]!
}

/** True si le produit appartient à la catégorie (Tout = toujours). */
export function hitMatchesFoodCategory(
  categoryId: FoodCategoryId,
  categoriesTags: string[] | undefined | null,
): boolean {
  if (categoryId === 'all') return true
  const cat = foodCategoryById(categoryId)
  if (cat.offTags.length === 0) return true
  const tags = (categoriesTags ?? []).map((t) => t.trim().toLowerCase())
  if (tags.length === 0) return false
  return cat.offTags.some((wanted) => {
    const w = wanted.toLowerCase()
    return tags.some((t) => t === w || t.includes(w.replace(/^en:/, '').replace(/^fr:/, '')))
  })
}

/** Tag OFF principal pour une requête catégorie (browse sans texte). */
export function primaryOffTagForCategory(categoryId: FoodCategoryId): string | null {
  if (categoryId === 'all') return null
  return foodCategoryById(categoryId).offTags[0] ?? null
}
