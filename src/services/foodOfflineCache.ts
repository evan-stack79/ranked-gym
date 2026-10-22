/**
 * Cache local des aliments récemment vus — fonctionne hors ligne.
 * Les images sont des octets (data URL) servis par nous, jamais un hotlink OFF.
 */
import type { OpenFoodFactsSearchHit } from './alimentsService'

const STORAGE_KEY = 'ranked-gym:food-offline-cache:v2'
const MAX_ITEMS = 40
const MAX_IMAGE_BYTES = 180_000

export type CachedFoodItem = OpenFoodFactsSearchHit & {
  cachedAt: number
  /** Portion déjà formatée ou serving_size brut. */
  servingSize?: string | null
  imageStorageId?: string
  /** Octets image (data URL) pour affichage hors ligne. */
  imageDataUrl?: string
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
    // Quota — drop image bytes from oldest and retry once.
    try {
      const slim = items.slice(0, Math.min(MAX_ITEMS, 20)).map((item) => {
        const { imageDataUrl: _drop, ...rest } = item
        void _drop
        return rest as CachedFoodItem
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
    } catch {
      // ignore
    }
  }
}

function keyOf(hit: Pick<OpenFoodFactsSearchHit, 'barcode' | 'nom'>): string {
  return `${hit.barcode}::${hit.nom}`.toLowerCase()
}

function isOwnedImageUrl(url: string): boolean {
  if (!url || /openfoodfacts\.org/i.test(url)) return false
  if (url.startsWith('data:image/')) return true
  if (url.includes('convex.cloud')) return true
  if (url.startsWith('/') || url.startsWith('blob:')) return true
  return /^https?:\/\//i.test(url)
}

async function fetchImageAsDataUrl(url: string): Promise<string | undefined> {
  if (!isOwnedImageUrl(url)) return undefined
  if (url.startsWith('data:image/')) return url
  if (typeof fetch === 'undefined') return undefined
  try {
    const response = await fetch(url, { credentials: 'omit', mode: 'cors' })
    if (!response.ok) return undefined
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return undefined
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return undefined
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return undefined
  }
}

/** Enregistre les hits vus et met en cache les octets image (best-effort). */
export function rememberFoodHits(hits: OpenFoodFactsSearchHit[]): void {
  if (!hits.length) return
  const now = Date.now()
  const map = new Map(readAll().map((item) => [keyOf(item), item]))
  for (const hit of hits) {
    const prev = map.get(keyOf(hit))
    // V3 public hits arrivent sans kcal/macros — ne pas écraser un cache déjà nourri.
    map.set(keyOf(hit), {
      ...hit,
      calories:
        hit.calories == null && prev?.calories != null ? prev.calories : hit.calories,
      proteines:
        hit.proteines == null && prev?.proteines != null ? prev.proteines : hit.proteines,
      glucides:
        hit.glucides == null && prev?.glucides != null ? prev.glucides : hit.glucides,
      lipides: hit.lipides == null && prev?.lipides != null ? prev.lipides : hit.lipides,
      cachedAt: now,
      imageDataUrl: prev?.imageDataUrl,
    })
  }
  const merged = Array.from(map.values()).sort((a, b) => b.cachedAt - a.cachedAt)
  writeAll(merged)

  // Async: télécharge les octets depuis NOTRE URL (pas OFF).
  void (async () => {
    const current = readAll()
    let changed = false
    for (const item of current.slice(0, 12)) {
      if (item.imageDataUrl) continue
      const url = item.imageUrl?.trim()
      if (!url || !isOwnedImageUrl(url)) continue
      const dataUrl = await fetchImageAsDataUrl(url)
      if (!dataUrl) continue
      item.imageDataUrl = dataUrl
      changed = true
    }
    if (changed) writeAll(current)
  })()
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
    .map((item) => ({
      ...item,
      // Hors ligne : préférer les octets locaux.
      imageUrl: item.imageDataUrl || item.imageUrl,
    }))
    .slice(0, limit)
}

/** Résout une URL affichable (data URL locale si présente). */
export function resolveCachedImageUrl(
  hit: Pick<OpenFoodFactsSearchHit, 'barcode' | 'nom' | 'imageUrl'>,
): string | undefined {
  const cached = readAll().find((item) => keyOf(item) === keyOf(hit))
  if (cached?.imageDataUrl) return cached.imageDataUrl
  const url = hit.imageUrl?.trim()
  if (url && isOwnedImageUrl(url)) return url
  return undefined
}

/** Lookup per-100 g par code OFF / code-barres (édition V3). */
export function findCachedFoodByOffCode(offCode: string | null | undefined): CachedFoodItem | undefined {
  const code = offCode?.trim().toLowerCase()
  if (!code) return undefined
  return readAll().find((item) => item.barcode.trim().toLowerCase() === code)
}

export function clearFoodOfflineCache(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  // Ancienne clé v1.
  localStorage.removeItem('ranked-gym:food-offline-cache:v1')
}
