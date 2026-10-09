import { isConvexDomainActive } from '../backend/adapter'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { AlimentRow } from '../types/database'
import { safeWarn } from '../utils/safeLog'
import {
  fetchOpenFoodFactsViaConvex,
  listConvexFoodCatalog,
  searchOpenFoodFactsViaConvex,
  setConvexFoodFavorite,
  upsertConvexFoodSelection,
  type CloudFoodRecord,
  type OpenFoodFactsProductCloud,
} from './convexNutritionService'

export interface OpenFoodFactsProduct {
  barcode: string
  nom: string
  calories: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  imageUrl?: string
  brands?: string
  /** serving_size brut OFF — formater via formatOffServingSize pour l’UI. */
  servingSize?: string | null
  /** categories_tags OFF (filtre roue). */
  categoriesTags?: string[]
  provenance: 'open_food_facts'
  fetchedAt: number
}

export interface OpenFoodFactsSearchHit extends OpenFoodFactsProduct {
  brands: string
  foodKey?: string
  isFavorite?: boolean
}

export interface PersonalFoodItem {
  foodKey: string
  barcode?: string
  nom: string
  brands?: string
  calories: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  imageUrl?: string
  provenance: 'open_food_facts'
  fetchedAt: number
  selectedCount: number
  isFavorite: boolean
  lastSelectedAt: number
}

interface OffProductFields {
  code?: string
  _id?: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  serving_size?: string
  categories_tags?: string[]
  nutriments?: {
    'energy-kcal_100g'?: number
    energy_kcal_100g?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
  image_front_small_url?: string
  image_front_url?: string
}

interface OffProductResponse {
  status: number
  product?: OffProductFields
}

interface OffSearchResponse {
  products?: OffProductFields[]
}

const SEARCH_PAGE_SIZE = 20

function asNullableNumber(value: unknown, precision = 1): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  if (precision === 0) return Math.round(n)
  const factor = precision === 1 ? 10 : 100
  return Math.round(n * factor) / factor
}

function mapCloudProduct(product: OpenFoodFactsProductCloud): OpenFoodFactsSearchHit {
  return {
    barcode: product.barcode,
    nom: product.nom,
    calories: product.calories,
    proteines: product.proteines,
    glucides: product.glucides,
    lipides: product.lipides,
    imageUrl: product.imageUrl,
    brands: product.brands ?? '',
    servingSize: null,
    categoriesTags: [],
    provenance: product.provenance,
    fetchedAt: product.fetchedAt,
  }
}

function mapOffProduct(raw: OffProductFields, fallbackBarcode: string): OpenFoodFactsSearchHit {
  const nutriments = raw.nutriments ?? {}
  const barcode = String(raw.code || raw._id || fallbackBarcode).trim() || fallbackBarcode
  const tags = Array.isArray(raw.categories_tags)
    ? raw.categories_tags.filter((t): t is string => typeof t === 'string')
    : []
  return {
    barcode,
    nom: raw.product_name_fr?.trim() || raw.product_name?.trim() || `Produit ${barcode}`,
    brands: raw.brands?.trim() || '',
    calories: asNullableNumber(nutriments['energy-kcal_100g'] ?? nutriments.energy_kcal_100g, 0),
    proteines: asNullableNumber(nutriments.proteins_100g),
    glucides: asNullableNumber(nutriments.carbohydrates_100g),
    lipides: asNullableNumber(nutriments.fat_100g),
    imageUrl: raw.image_front_small_url || raw.image_front_url,
    servingSize: raw.serving_size?.trim() || null,
    categoriesTags: tags,
    provenance: 'open_food_facts',
    fetchedAt: Date.now(),
  }
}

async function fetchOpenFoodFactsDirect(barcode: string): Promise<OpenFoodFactsProduct> {
  const code = barcode.trim()
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RankedGym/1.0 (support@rankedgym.app)',
      },
    },
  )
  if (!response.ok) {
    throw new Error('Open Food Facts indisponible. Réessaie.')
  }
  const data = (await response.json()) as OffProductResponse
  if (data.status !== 1 || !data.product) {
    throw new Error('Produit introuvable dans Open Food Facts.')
  }
  return mapOffProduct(data.product, code)
}

async function searchOpenFoodFactsDirect(
  term: string,
  signal?: AbortSignal,
  options?: { categoryTag?: string | null },
): Promise<OpenFoodFactsSearchHit[]> {
  const searchTerm = term.trim()
  const categoryTag = options?.categoryTag?.trim() || ''
  if (searchTerm.length < 2 && !categoryTag) return []

  const params = new URLSearchParams()
  params.set('action', 'process')
  params.set('json', '1')
  params.set('sort_by', 'unique_scans_n')
  params.set('page_size', String(SEARCH_PAGE_SIZE))
  if (searchTerm.length >= 2) {
    params.set('search_terms', searchTerm)
    params.set('search_simple', '1')
  }
  if (categoryTag) {
    params.set('tagtype_0', 'categories')
    params.set('tag_contains_0', 'contains')
    params.set('tag_0', categoryTag)
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RankedGym/1.0 (support@rankedgym.app)',
    },
  })
  if (!response.ok) {
    throw new Error('Recherche Open Food Facts indisponible. Réessaie.')
  }
  const data = (await response.json()) as OffSearchResponse
  const products = Array.isArray(data.products) ? data.products : []
  const hits: OpenFoodFactsSearchHit[] = []
  for (const raw of products) {
    const name = raw.product_name_fr?.trim() || raw.product_name?.trim() || ''
    if (!name) continue
    hits.push(mapOffProduct(raw, String(raw.code || raw._id || `search-${hits.length}`)))
    if (hits.length >= SEARCH_PAGE_SIZE) break
  }
  return hits
}

export async function fetchOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct> {
  if (isConvexDomainActive()) {
    try {
      const product = await fetchOpenFoodFactsViaConvex(barcode)
      return mapCloudProduct(product)
    } catch (error) {
      safeWarn('[aliments] convex OFF barcode lookup failed, fallback direct', error)
    }
  }
  return fetchOpenFoodFactsDirect(barcode)
}

export async function saveAliment(
  product: OpenFoodFactsProduct,
  userId?: string | null,
): Promise<AlimentRow | null> {
  if (isConvexDomainActive()) {
    try {
      await upsertConvexFoodSelection({
        barcode: product.barcode,
        name: product.nom,
        brand: product.brands,
        caloriesPer100g: product.calories,
        proteinPer100g: product.proteines,
        carbsPer100g: product.glucides,
        fatPer100g: product.lipides,
        imageUrl: product.imageUrl,
        source: 'open_food_facts',
        fetchedAt: product.fetchedAt,
      })
      return null
    } catch (error) {
      safeWarn('[aliments] convex save failed', error)
      throw new Error('Impossible d’enregistrer cet aliment sur Convex. Réessaie.')
    }
  }
  if (!isSupabaseConfigured() || !userId) return null
  if (
    product.calories == null ||
    product.proteines == null ||
    product.glucides == null ||
    product.lipides == null
  ) {
    safeWarn('[aliments] supabase fallback skipped: missing nutrient fields')
    return null
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('aliments')
    .insert({
      user_id: userId,
      nom: product.nom,
      calories: product.calories,
      proteines: product.proteines,
      glucides: product.glucides,
      lipides: product.lipides,
      barcode: product.barcode,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function searchOpenFoodFacts(
  term: string,
  signal?: AbortSignal,
  options?: { categoryTag?: string | null },
): Promise<OpenFoodFactsSearchHit[]> {
  const categoryTag = options?.categoryTag?.trim() || null
  const searchTerm = term.trim()

  // Direct OFF : serving_size + categories_tags (absents du proxy Convex actuel, sans deploy).
  const directPromise = searchOpenFoodFactsDirect(searchTerm, signal, { categoryTag }).catch(
    (error) => {
      safeWarn('[aliments] direct OFF search failed', error)
      return [] as OpenFoodFactsSearchHit[]
    },
  )

  if (isConvexDomainActive() && !categoryTag && searchTerm.length >= 2) {
    try {
      const [directHits, personal] = await Promise.all([
        directPromise,
        listConvexFoodCatalog({ limit: SEARCH_PAGE_SIZE * 2 }).catch(() => []),
      ])

      const merged = new Map<string, OpenFoodFactsSearchHit>()
      for (const hit of personal.filter((row) => matchCatalogRow(row, searchTerm)).map(mapCatalogToHit)) {
        const key = `${hit.barcode}::${hit.nom}`.toLowerCase()
        if (!merged.has(key)) merged.set(key, hit)
      }
      for (const hit of directHits) {
        const key = `${hit.barcode}::${hit.nom}`.toLowerCase()
        const existing = merged.get(key)
        if (!existing) {
          merged.set(key, hit)
        } else {
          // Préfère serving_size / image / tags du hit direct.
          merged.set(key, {
            ...existing,
            servingSize: existing.servingSize || hit.servingSize,
            categoriesTags:
              existing.categoriesTags && existing.categoriesTags.length > 0
                ? existing.categoriesTags
                : hit.categoriesTags,
            imageUrl: existing.imageUrl || hit.imageUrl,
            calories: existing.calories ?? hit.calories,
            proteines: existing.proteines ?? hit.proteines,
            glucides: existing.glucides ?? hit.glucides,
            lipides: existing.lipides ?? hit.lipides,
          })
        }
        if (merged.size >= SEARCH_PAGE_SIZE) break
      }
      if (merged.size > 0) return Array.from(merged.values()).slice(0, SEARCH_PAGE_SIZE)
    } catch (error) {
      safeWarn('[aliments] convex catalog merge failed, fallback direct', error)
    }
  }

  const direct = await directPromise
  if (direct.length > 0) return direct

  // Dernier recours : proxy Convex (sans serving_size).
  if (isConvexDomainActive() && searchTerm.length >= 2 && !categoryTag) {
    try {
      const hits = await searchOpenFoodFactsViaConvex(searchTerm, SEARCH_PAGE_SIZE)
      return hits.map(mapCloudProduct)
    } catch (error) {
      safeWarn('[aliments] convex OFF search failed', error)
    }
  }
  return []
}

function mapFoodCatalogRecord(row: CloudFoodRecord): PersonalFoodItem {
  return {
    foodKey: row.foodKey,
    barcode: row.barcode,
    nom: row.name,
    brands: row.brand,
    calories: row.caloriesPer100g,
    proteines: row.proteinPer100g,
    glucides: row.carbsPer100g,
    lipides: row.fatPer100g,
    imageUrl: row.imageUrl,
    provenance: 'open_food_facts',
    fetchedAt: row.lastFetchedAt,
    selectedCount: row.selectedCount,
    isFavorite: row.isFavorite,
    lastSelectedAt: row.lastSelectedAt,
  }
}

function mapCatalogToHit(row: CloudFoodRecord): OpenFoodFactsSearchHit {
  return {
    barcode: row.barcode || row.foodKey,
    nom: row.name,
    brands: row.brand ?? '',
    calories: row.caloriesPer100g,
    proteines: row.proteinPer100g,
    glucides: row.carbsPer100g,
    lipides: row.fatPer100g,
    imageUrl: row.imageUrl,
    servingSize: null,
    categoriesTags: [],
    provenance: 'open_food_facts',
    fetchedAt: row.lastFetchedAt,
    foodKey: row.foodKey,
    isFavorite: row.isFavorite,
  }
}

function matchCatalogRow(row: CloudFoodRecord, term: string): boolean {
  const normalized = term.trim().toLowerCase()
  if (normalized.length < 2) return false
  const haystack = `${row.name} ${row.brand ?? ''} ${row.barcode ?? ''}`.toLowerCase()
  return haystack.includes(normalized)
}

export async function listPersonalFoods(options?: {
  limit?: number
  favoritesOnly?: boolean
}): Promise<PersonalFoodItem[]> {
  if (isConvexDomainActive()) {
    try {
      const rows = await listConvexFoodCatalog({
        limit: options?.limit,
        favoritesOnly: options?.favoritesOnly,
      })
      return rows.map(mapFoodCatalogRecord)
    } catch (error) {
      safeWarn('[aliments] listPersonalFoods convex failed', error)
    }
  }

  return []
}

export async function setPersonalFoodFavorite(foodKey: string, isFavorite: boolean): Promise<boolean> {
  if (!isConvexDomainActive()) return false
  try {
    const result = await setConvexFoodFavorite(foodKey, isFavorite)
    return result.applied
  } catch (error) {
    safeWarn('[aliments] set favorite failed', error)
    return false
  }
}
