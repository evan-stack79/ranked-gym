/**
 * Cache local des aliments récemment vus — fonctionne hors ligne.
 * Les images sont des URLs de NOTRE stockage (Convex) ou data URL ;
 * jamais de hotlink Open Food Facts.
 */
import type { OpenFoodFactsSearchHit } from './alimentsService'

const STORAGE_KEY = 'ranked-gym:food-offline-cache:v1'
const MAX_ITEMS = 80

export type CachedFoodItem = OpenFoodFactsSearchHit & {
  cachedAt: number
  /** Portion déjà formatée ou serving_size brut. */
  servingSize?: string | null
  imageStorageId?: string
}

function readAll(): CachedFoodItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CachedFoodItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: CachedFoodItem[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // Quota — ignore.
  }
}

function keyOf(hit: Pick<OpenFoodFactsSearchHit, 'barcode' | 'nom'>): string {
  return `${hit.barcode}::${hit.nom}`.toLowerCase()
}

/** Enregistre les hits vus (après recherche Convex) pour l’offline. */
export function rememberFoodHits(hits: OpenFoodFactsSearchHit[]): void {
  if (!hits.length) return
  const now = Date.now()
  const map = new Map(readAll().map((item) => [keyOf(item), item]))
  for (const hit of hits) {
    map.set(keyOf(hit), { ...hit, cachedAt: now })
  }
  const merged = Array.from(map.values()).sort((a, b) => b.cachedAt - a.cachedAt)
  writeAll(merged)
}

/** Liste offline (récents d’abord), filtrable par terme / catégorie tags. */
export function listCachedFoods(options?: {
  term?: string
  categoryTag?: string | null
  limit?: number
}): CachedFoodItem[] {
  const limit = Math.max(1, Math.min(MAX_ITEMS, options?.limit ?? 40))
  const term = options?.term?.trim().toLowerCase() ?? ''
  const tag = options?.categoryTag?.trim().toLowerCase() ?? ''
  return readAll()
    .filter((item) => {
      if (term.length >= 2) {
        const hay = `${item.nom} ${item.brands ?? ''} ${item.barcode}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (tag) {
        const tags = (item.categoriesTags ?? []).map((t) => t.toLowerCase())
        const needle = tag.replace(/^en:/, '').replace(/^fr:/, '')
        if (!tags.some((t) => t === tag || t.includes(needle))) return false
      }
      return true
    })
    .slice(0, limit)
}

export function clearFoodOfflineCache(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
