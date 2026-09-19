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
 * Recherche textuelle Open Food Facts (world + tri par scans).
 * GET search.pl — limitée à 20 résultats.
 * `encodeURIComponent` obligatoire pour espaces / accents (ex. « Pâte panzani »).
 * Retry léger sur 5xx / réseau ; timeout borné.
 */
export async function searchOpenFoodFacts(
  term: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsSearchHit[]> {
  const searchTerm = term.trim()
  if (searchTerm.length < 2) return []

  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(searchTerm)}` +
    `&search_simple=1&action=process&json=1` +
    `&sort_by=unique_scans_n&page_size=${SEARCH_PAGE_SIZE}`

  const maxAttempts = 2
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const attemptController = new AbortController()
    const onAbort = () => attemptController.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = window.setTimeout(() => attemptController.abort(), 12_000)

    try {
      const response = await fetch(url, {
        signal: attemptController.signal,
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const err = new Error(
          response.status >= 500
            ? 'Recherche Open Food Facts indisponible. Réessaie.'
            : `Recherche Open Food Facts indisponible (${response.status}).`,
        )
        lastError = err
        if (response.status >= 500 && attempt + 1 < maxAttempts) {
          await new Promise((r) => window.setTimeout(r, 350 * (attempt + 1)))
          continue
        }
        throw err
      }

      let data: OffSearchResponse
      try {
        data = (await response.json()) as OffSearchResponse
      } catch (parseErr) {
        lastError = parseErr
        throw new Error('Invalid response JSON from Open Food Facts')
      }

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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (signal?.aborted) throw err
        lastError = new Error('timeout')
        if (attempt + 1 < maxAttempts) continue
        throw lastError
      }
      lastError = err
      if (attempt + 1 < maxAttempts && isRetryableNetwork(err)) {
        await new Promise((r) => window.setTimeout(r, 350 * (attempt + 1)))
        continue
      }
      throw err
    } finally {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw lastError ?? new Error('Recherche Open Food Facts indisponible. Réessaie.')
}

function isRetryableNetwork(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  return (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('timeout')
  )
}
