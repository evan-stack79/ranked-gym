/**
 * Recherche Open Food Facts côté serveur — URL FR, pertinence, timeout + retry.
 * Pas de contact OFF depuis le téléphone.
 */

export const OFF_SEARCH_USER_AGENT = 'RankedGym/1.0 (support@rankedgym.app)'
/** Timeout par tentative — assez large pour OFF lent, avec un nouvel essai. */
export const OFF_SEARCH_TIMEOUT_MS = 12_000
/** Produits demandés à OFF (avant re-tri pertinence). */
export const OFF_SEARCH_PAGE_SIZE = 40
/** Plafond renvoyé à l’app. */
export const OFF_SEARCH_RETURN_LIMIT = 40
/** Base FR (noms / priorités France). */
export const OFF_SEARCH_BASE_URL = 'https://fr.openfoodfacts.org/cgi/search.pl'

export type OffSearchProduct = {
  code?: string
  _id?: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  countries_tags?: string[]
  categories_tags?: string[]
  unique_scans_n?: number
}

export function normalizeOffSearchTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function buildOffSearchUrl(input: {
  term: string
  categoryTag?: string | null
  pageSize?: number
}): string {
  const term = input.term.trim()
  const categoryTag = input.categoryTag?.trim() || ''
  const pageSize = Math.max(
    1,
    Math.min(OFF_SEARCH_PAGE_SIZE, Math.floor(input.pageSize ?? OFF_SEARCH_PAGE_SIZE)),
  )
  const params = new URLSearchParams()
  params.set('action', 'process')
  params.set('json', '1')
  params.set('search_simple', '1')
  params.set('lc', 'fr')
  params.set('cc', 'fr')
  // Popularité OFF en second critère — le tri pertinence se fait ensuite.
  params.set('sort_by', 'unique_scans_n')
  params.set('page_size', String(pageSize))
  if (term.length >= 2) {
    params.set('search_terms', term)
  }
  // Pas de filtre pays dur (produits sans countries_tags exclus) —
  // priorité France via fr.* + lc/cc=fr + scoreOffSearchProduct.
  if (categoryTag) {
    params.set('tagtype_0', 'categories')
    params.set('tag_contains_0', 'contains')
    params.set('tag_0', categoryTag)
  }
  return `${OFF_SEARCH_BASE_URL}?${params.toString()}`
}

function productDisplayName(product: OffSearchProduct): string {
  return (product.product_name_fr?.trim() || product.product_name?.trim() || '').trim()
}

function isFranceProduct(product: OffSearchProduct): boolean {
  const tags = Array.isArray(product.countries_tags) ? product.countries_tags : []
  return tags.some((t) => {
    const n = String(t).toLowerCase()
    return n === 'en:france' || n.includes('france')
  })
}

/**
 * Score plus bas = plus pertinent.
 * Exact / préfixe du nom avant « contient » ; France et nom FR en bonus.
 */
export function scoreOffSearchProduct(term: string, product: OffSearchProduct): number {
  const t = normalizeOffSearchTerm(term)
  if (!t) return 50
  const nameFr = normalizeOffSearchTerm(product.product_name_fr || '')
  const nameEn = normalizeOffSearchTerm(product.product_name || '')
  const primary = nameFr || nameEn
  if (!primary) return 40

  let score: number
  if (primary === t || nameFr === t || nameEn === t) {
    score = 0
  } else if (primary.startsWith(`${t} `) || primary.startsWith(t)) {
    score = 1
  } else if (nameFr.startsWith(t) || nameEn.startsWith(t)) {
    score = 2
  } else {
    const words = primary.split(/[\s,/+()._-]+/).filter(Boolean)
    if (words.some((w) => w === t)) score = 3
    else if (words.some((w) => w.startsWith(t))) score = 4
    else if (primary.includes(t)) score = 5
    else score = 12
  }

  if (!nameFr) score += 0.4
  if (!isFranceProduct(product)) score += 0.6
  // Légère préférence popularité (unique_scans) pour départager.
  const scans = typeof product.unique_scans_n === 'number' ? product.unique_scans_n : 0
  score += 1 / (1 + Math.max(0, scans))
  return score
}

/** Trie par pertinence (nom exact / préfixe d’abord), puis popularité. */
export function rankOffSearchProducts<T extends OffSearchProduct>(
  term: string,
  products: T[],
): T[] {
  return [...products].sort((a, b) => {
    const diff = scoreOffSearchProduct(term, a) - scoreOffSearchProduct(term, b)
    if (diff !== 0) return diff
    const scansA = typeof a.unique_scans_n === 'number' ? a.unique_scans_n : 0
    const scansB = typeof b.unique_scans_n === 'number' ? b.unique_scans_n : 0
    return scansB - scansA
  })
}

export function pickOffSearchProducts<T extends OffSearchProduct>(
  term: string,
  products: T[],
  limit: number,
): T[] {
  const ranked = rankOffSearchProducts(term, products)
  const max = Math.max(1, Math.min(OFF_SEARCH_RETURN_LIMIT, Math.floor(limit)))
  return ranked.slice(0, max)
}

export function offProductLabel(product: OffSearchProduct): string {
  return productDisplayName(product) || 'Produit'
}

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text?: () => Promise<string>
}>

/**
 * GET JSON OFF avec timeout + un nouvel essai sur abort / 5xx / réseau.
 * Ne renvoie jamais un tableau vide en cas d’erreur — throw.
 */
export async function fetchOffSearchJson(
  url: string,
  options?: {
    fetchImpl?: FetchLike
    timeoutMs?: number
    retries?: number
  },
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as FetchLike)
  const timeoutMs = options?.timeoutMs ?? OFF_SEARCH_TIMEOUT_MS
  const retries = options?.retries ?? 1
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': OFF_SEARCH_USER_AGENT,
          From: 'support@rankedgym.app',
        },
      })
      if (!response.ok) {
        const err = new Error(`OFF_HTTP_${response.status}`)
        lastError = err
        if (response.status >= 500 && attempt < retries) continue
        throw err
      }
      return await response.json()
    } catch (error) {
      lastError = error
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String((error as { name?: unknown }).name)
          : ''
      const message = error instanceof Error ? error.message : String(error)
      const retryable =
        name === 'AbortError' ||
        message.includes('OFF_HTTP_5') ||
        message.includes('Failed to fetch') ||
        message.includes('network') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT')
      if (retryable && attempt < retries) continue
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('OFF_SEARCH_FAILED')
}
