/**
 * Catégories d’icônes V3 — déduites des categories_tags OFF.
 * Jamais de photo contributeur ; repli « autre ».
 */

export type FoodIconCategoryId =
  | 'viennoiserie'
  | 'pain'
  | 'produit_laitier'
  | 'fruit'
  | 'legume'
  | 'viande'
  | 'poisson'
  | 'boisson'
  | 'plat'
  | 'snack'
  | 'autre'

export const FOOD_ICON_CATEGORY_IDS: readonly FoodIconCategoryId[] = [
  'viennoiserie',
  'pain',
  'produit_laitier',
  'fruit',
  'legume',
  'viande',
  'poisson',
  'boisson',
  'plat',
  'snack',
  'autre',
] as const

export const FOOD_ICON_CATEGORY_LABELS: Record<FoodIconCategoryId, string> = {
  viennoiserie: 'Viennoiserie',
  pain: 'Pain',
  produit_laitier: 'Produit laitier',
  fruit: 'Fruit',
  legume: 'Légume',
  viande: 'Viande',
  poisson: 'Poisson',
  boisson: 'Boisson',
  plat: 'Plat',
  snack: 'Snack',
  autre: 'Autre',
}

/** Couleur icône V3 (sobre, pas de glow). */
export const FOOD_ICON_STROKE = '#FF0702'

type Rule = { id: FoodIconCategoryId; tags: string[] }

/**
 * Ordre = priorité (viennoiserie avant pain, fruit avant snack sucré, etc.).
 * Matching souple : égalité ou inclusion du fragment sans préfixe en:/fr:.
 */
const RULES: readonly Rule[] = [
  {
    id: 'viennoiserie',
    tags: [
      'en:viennoiseries',
      'en:croissants',
      'en:brioches',
      'en:puff-pastry',
      'fr:viennoiseries',
      'fr:croissants',
      'fr:pains-au-chocolat',
    ],
  },
  {
    id: 'pain',
    tags: [
      'en:breads',
      'en:bread',
      'en:baguettes',
      'en:sliced-breads',
      'fr:pains',
      'fr:baguettes',
    ],
  },
  {
    id: 'produit_laitier',
    tags: [
      'en:dairies',
      'en:dairy',
      'en:milks',
      'en:yogurts',
      'en:yoghurts',
      'en:cheeses',
      'en:fermented-milk-products',
      'fr:produits-laitiers',
      'fr:yaourts',
      'fr:fromages',
    ],
  },
  {
    id: 'fruit',
    tags: [
      'en:fruits',
      'en:fresh-fruits',
      'en:dried-fruits',
      'en:fruit-based-foods',
      'fr:fruits',
    ],
  },
  {
    id: 'legume',
    tags: [
      'en:vegetables',
      'en:fresh-vegetables',
      'en:legumes',
      'en:plant-based-foods',
      'fr:legumes',
      'fr:légumes',
    ],
  },
  {
    id: 'viande',
    tags: [
      'en:meats',
      'en:meat',
      'en:poultry',
      'en:chicken',
      'en:beef',
      'en:pork',
      'fr:viandes',
      'fr:volailles',
    ],
  },
  {
    id: 'poisson',
    tags: [
      'en:seafood',
      'en:fishes',
      'en:fish',
      'en:farmed-fishes',
      'en:shellfish',
      'fr:poissons',
      'fr:fruits-de-mer',
    ],
  },
  {
    id: 'boisson',
    tags: [
      'en:beverages',
      'en:drinks',
      'en:waters',
      'en:sodas',
      'en:fruit-juices',
      'en:plant-milks',
      'fr:boissons',
    ],
  },
  {
    id: 'plat',
    tags: [
      'en:meals',
      'en:prepared-meals',
      'en:one-dish-meals',
      'en:frozen-foods',
      'fr:plats-prepares',
      'fr:plats',
    ],
  },
  {
    id: 'snack',
    tags: [
      'en:snacks',
      'en:salty-snacks',
      'en:sweet-snacks',
      'en:chips',
      'en:biscuits',
      'en:chocolates',
      'en:spreads',
      'fr:snacks',
      'fr:biscuits',
    ],
  },
]

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function tagMatches(haystack: string, wanted: string): boolean {
  const h = normalizeTag(haystack)
  const w = normalizeTag(wanted)
  if (h === w) return true
  const bare = w.replace(/^en:/, '').replace(/^fr:/, '')
  return h.includes(bare) || h.endsWith(`:${bare}`)
}

/** Déduit l’icône depuis categories_tags OFF ; sinon « autre ». */
export function resolveFoodIconCategory(
  categoriesTags: string[] | undefined | null,
): FoodIconCategoryId {
  const tags = (categoriesTags ?? []).map(normalizeTag).filter(Boolean)
  if (tags.length === 0) return 'autre'
  for (const rule of RULES) {
    if (rule.tags.some((wanted) => tags.some((t) => tagMatches(t, wanted)))) {
      return rule.id
    }
  }
  return 'autre'
}

export function isFoodIconCategoryId(value: unknown): value is FoodIconCategoryId {
  return typeof value === 'string' && (FOOD_ICON_CATEGORY_IDS as readonly string[]).includes(value)
}
