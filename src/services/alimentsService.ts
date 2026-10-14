import { isConvexDomainActive } from '../backend/adapter'
import { isFoodAddV3Enabled } from '../backend/foodAddV3FeatureFlag'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { AlimentRow } from '../types/database'
import { safeWarn } from '../utils/safeLog'
import {
  fetchOpenFoodFactsViaConvex,
  listConvexFoodCatalog,
  searchFoodsV3ViaConvex,
  searchOpenFoodFactsViaConvex,
  setConvexFoodFavorite,
  upsertConvexFoodSelection,
  type CloudFoodRecord,
  type OpenFoodFactsProductCloud,
} from './convexNutritionService'
import { listCachedFoods, rememberFoodHits } from './foodOfflineCache'

export interface OpenFoodFactsProduct {
  barcode: string
  nom: string
  calories: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  /** URL de NOTRE cache / stockage — jamais un hotlink OFF. */
  imageUrl?: string
  imageStorageId?: string
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

const SEARCH_PAGE_SIZE = 20

function mapCloudProduct(product: OpenFoodFactsProductCloud): OpenFoodFactsSearchHit {
  return {
    barcode: product.barcode,
    nom: product.nom,
    calories: product.calories,
    proteines: product.proteines,
    glucides: product.glucides,
    lipides: product.lipides,
    imageUrl: product.imageUrl,
    imageStorageId: product.imageStorageId,
    brands: product.brands ?? '',
    servingSize: product.servingSize ?? null,
    categoriesTags: product.categoriesTags ?? [],
    provenance: product.provenance,
    fetchedAt: product.fetchedAt,
  }
}

function mapAccessError(error: unknown): Error | null {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('FOOD_SEARCH_DAILY_LIMIT')) {
    return new Error('Limite quotidienne de recherches atteinte. Réessaie demain.')
  }
  if (
    message.includes('FOOD_ADD_ACCESS_DENIED') ||
    message.includes('FOOD_ADD_ACCESS_DENIED_MINOR') ||
    message.includes('FOOD_ADD_ACCESS_DENIED_TCA')
  ) {
    return new Error('Ajout d’aliment indisponible pour ce compte.')
  }
  return null
}

/**
 * Le téléphone ne contacte JAMAIS Open Food Facts (flag ON ou OFF).
 * Barcode → Convex uniquement ; échec → erreur (pas de repli world.openfoodfacts.org).
 */
export async function fetchOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct> {
  if (!isConvexDomainActive()) {
    throw new Error('Recherche produit indisponible hors ligne serveur.')
  }
  try {
    const product = await fetchOpenFoodFactsViaConvex(barcode)
    return mapCloudProduct(product)
  } catch (error) {
    const access = mapAccessError(error)
    if (access) throw access
    safeWarn('[aliments] convex OFF barcode lookup failed (no direct OFF fallback)', error)
    throw new Error('Produit introuvable. Réessaie.')
  }
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

/**
 * Recherche OFF — toujours via notre serveur (Convex) + cache offline.
 * Aucun fetch vers world.openfoodfacts.org depuis le téléphone.
 */
export async function searchOpenFoodFacts(
  term: string,
  signal?: AbortSignal,
  options?: { categoryTag?: string | null },
): Promise<OpenFoodFactsSearchHit[]> {
  const categoryTag = options?.categoryTag?.trim() || null
  const searchTerm = term.trim()

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return listCachedFoods({ term: searchTerm, categoryTag, limit: SEARCH_PAGE_SIZE })
  }

  if (!isConvexDomainActive()) {
    return listCachedFoods({ term: searchTerm, categoryTag, limit: SEARCH_PAGE_SIZE })
  }

  // Catégorie ou v3 : action searchFoods (serveur mirror + quota).
  if (isFoodAddV3Enabled() || categoryTag) {
    try {
      const { hits } = await searchFoodsV3ViaConvex({
        term: searchTerm,
        categoryTag,
        limit: SEARCH_PAGE_SIZE,
      })
      if (signal?.aborted) return []
      const mapped = hits.map(mapCloudProduct)
      void rememberFoodHits(mapped)
      return mapped
    } catch (error) {
      if (signal?.aborted) return []
      const access = mapAccessError(error)
      if (access) throw access
      safeWarn('[aliments] Convex search failed, fallback offline cache', error)
      return listCachedFoods({ term: searchTerm, categoryTag, limit: SEARCH_PAGE_SIZE })
    }
  }

  // Legacy texte (flag OFF, sans catégorie) : Convex searchOpenFoodFacts + catalogue.
  if (searchTerm.length < 2) return []

  try {
    const [hits, personal] = await Promise.all([
      searchOpenFoodFactsViaConvex(searchTerm, SEARCH_PAGE_SIZE),
      listConvexFoodCatalog({ limit: SEARCH_PAGE_SIZE * 2 }),
    ])

    const merged = new Map<string, OpenFoodFactsSearchHit>()
    for (const hit of personal.filter((row) => matchCatalogRow(row, searchTerm)).map(mapCatalogToHit)) {
      const key = `${hit.barcode}::${hit.nom}`.toLowerCase()
      if (!merged.has(key)) merged.set(key, hit)
      if (merged.size >= SEARCH_PAGE_SIZE) {
        const result = Array.from(merged.values())
        void rememberFoodHits(result)
        return result
      }
    }
    for (const hit of hits.map(mapCloudProduct)) {
      const key = `${hit.barcode}::${hit.nom}`.toLowerCase()
      if (!merged.has(key)) merged.set(key, hit)
      if (merged.size >= SEARCH_PAGE_SIZE) break
    }
    const result = Array.from(merged.values())
    void rememberFoodHits(result)
    return result
  } catch (error) {
    if (signal?.aborted) return []
    const access = mapAccessError(error)
    if (access) throw access
    safeWarn('[aliments] convex OFF search failed, fallback offline cache', error)
    return listCachedFoods({ term: searchTerm, categoryTag, limit: SEARCH_PAGE_SIZE })
  }
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
