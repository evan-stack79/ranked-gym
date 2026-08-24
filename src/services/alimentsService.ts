import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { AlimentRow } from '../types/database'

export interface OpenFoodFactsProduct {
  barcode: string
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
  imageUrl?: string
}

interface OffProductResponse {
  status: number
  product?: {
    product_name?: string
    product_name_fr?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      energy_kcal_100g?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
    }
    image_front_small_url?: string
  }
}

export async function fetchOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct> {
  const code = barcode.trim()
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
  )

  if (!response.ok) {
    throw new Error('Open Food Facts indisponible. Réessaie.')
  }

  const data = (await response.json()) as OffProductResponse
  if (data.status !== 1 || !data.product) {
    throw new Error('Produit introuvable dans Open Food Facts.')
  }

  const n = data.product.nutriments ?? {}
  // Open Food Facts: always use *_100g so portions stay honest and scalable in the UI.
  const calories = Number(n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? 0)
  const proteines = Number(n.proteins_100g ?? 0)
  const glucides = Number(n.carbohydrates_100g ?? 0)
  const lipides = Number(n.fat_100g ?? 0)
  const nom =
    data.product.product_name_fr?.trim() ||
    data.product.product_name?.trim() ||
    `Produit ${code}`

  return {
    barcode: code,
    nom,
    calories: Math.round(calories),
    proteines: Math.round(proteines * 10) / 10,
    glucides: Math.round(glucides * 10) / 10,
    lipides: Math.round(lipides * 10) / 10,
    imageUrl: data.product.image_front_small_url,
  }
}

export async function saveAliment(
  product: OpenFoodFactsProduct,
  userId?: string | null,
): Promise<AlimentRow | null> {
  if (!isSupabaseConfigured() || !userId) return null

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

export interface OpenFoodFactsSearchHit extends OpenFoodFactsProduct {
  brands: string
}

interface OffSearchResponse {
  products?: Array<{
    code?: string
    _id?: string
    product_name?: string
    product_name_fr?: string
    brands?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      energy_kcal_100g?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
    }
    image_front_small_url?: string
  }>
}

const SEARCH_PAGE_SIZE = 20

/**
 * Recherche textuelle Open Food Facts (indépendante du scan code-barres).
 * GET search.pl — limitée à 20 résultats.
 */
export async function searchOpenFoodFacts(
  term: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsSearchHit[]> {
  const query = term.trim()
  if (query.length < 2) return []

  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${SEARCH_PAGE_SIZE}`

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RankedGym/1.0 (https://github.com/evan-stack79/ranked-gym)',
    },
  })

  if (!response.ok) {
    throw new Error('Recherche Open Food Facts indisponible. Réessaie.')
  }

  const data = (await response.json()) as OffSearchResponse
  const products = Array.isArray(data.products) ? data.products : []

  const hits: OpenFoodFactsSearchHit[] = []
  for (const raw of products) {
    const nom =
      raw.product_name_fr?.trim() || raw.product_name?.trim() || ''
    if (!nom) continue

    const n = raw.nutriments ?? {}
    const calories = Number(n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? 0)
    const proteines = Number(n.proteins_100g ?? 0)
    const glucides = Number(n.carbohydrates_100g ?? 0)
    const lipides = Number(n.fat_100g ?? 0)
    const barcode = String(raw.code || raw._id || '').trim() || `search-${hits.length}`

    hits.push({
      barcode,
      nom,
      brands: raw.brands?.trim() || '',
      calories: Number.isFinite(calories) ? Math.round(calories) : 0,
      proteines: Number.isFinite(proteines) ? Math.round(proteines * 10) / 10 : 0,
      glucides: Number.isFinite(glucides) ? Math.round(glucides * 10) / 10 : 0,
      lipides: Number.isFinite(lipides) ? Math.round(lipides * 10) / 10 : 0,
      imageUrl: raw.image_front_small_url,
    })

    if (hits.length >= SEARCH_PAGE_SIZE) break
  }

  return hits
}
