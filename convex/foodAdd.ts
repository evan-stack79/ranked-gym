/**
 * « Ajouter un aliment » v3 — recherche OFF via Convex (jamais depuis le téléphone),
 * limite journalière, images copiées dans notre storage, snapshot à l’ajout,
 * garde mineur / TCA.
 *
 * Ne pas déployer depuis ce dépôt — le Studio Manager gère Convex prod.
 */
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import {
  assertFoodAddAccessFromStoredProfile,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
} from './lib/foodAddAccess'

const OFF_USER_AGENT = 'RankedGym/1.0 (support@rankedgym.app)'
const OFF_TIMEOUT_MS = 8_000
const OFF_MAX_RESULTS = 20
const FOOD_SEARCH_DAILY_LIMIT = 40
const IMAGE_MAX_BYTES = 1_500_000
const NUTRITION_SCHEMA_VERSION = 1

type OffApiProduct = {
  code?: string
  _id?: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  serving_size?: string
  categories_tags?: string[]
  image_front_small_url?: string
  image_front_url?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    energy_kcal_100g?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
}

function toDateKey(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function asNullableNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function mealName(value: string): string {
  const next = value.trim()
  if (!next) throw new Error('NUTRITION_MEAL_NAME_REQUIRED')
  return next.slice(0, 120)
}

function normalizeFoodKey(input: { barcode?: string; name: string; brand?: string }): string {
  const barcode = input.barcode?.trim()
  if (barcode) return `barcode:${barcode}`
  const name = input.name.trim().toLowerCase().slice(0, 140)
  const brand = input.brand?.trim().toLowerCase().slice(0, 80) ?? ''
  return `name:${name}|brand:${brand}`
}

function normalizeDateKey(value: string): string {
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('NUTRITION_DATEKEY_INVALID')
  }
  return normalized
}

async function fetchOffJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_USER_AGENT,
        From: 'support@rankedgym.app',
      },
    })
    if (!response.ok) throw new Error(`OFF_HTTP_${response.status}`)
    return (await response.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

function mapOffProduct(raw: OffApiProduct, fallbackBarcode: string) {
  const nutriments = raw.nutriments ?? {}
  const barcode = String(raw.code || raw._id || fallbackBarcode).trim()
  const nom =
    raw.product_name_fr?.trim() ||
    raw.product_name?.trim() ||
    (barcode ? `Produit ${barcode}` : 'Produit')
  const tags = Array.isArray(raw.categories_tags)
    ? raw.categories_tags.filter((t): t is string => typeof t === 'string').slice(0, 40)
    : []
  return {
    barcode,
    nom,
    brands: raw.brands?.trim() || '',
    calories: asNullableNumber(nutriments['energy-kcal_100g'] ?? nutriments.energy_kcal_100g),
    proteines: asNullableNumber(nutriments.proteins_100g),
    glucides: asNullableNumber(nutriments.carbohydrates_100g),
    lipides: asNullableNumber(nutriments.fat_100g),
    servingSize: raw.serving_size?.trim() || null,
    categoriesTags: tags,
    offImageUrl: raw.image_front_small_url || raw.image_front_url || undefined,
    provenance: 'open_food_facts' as const,
    fetchedAt: Date.now(),
  }
}

const foodHitValidator = v.object({
  barcode: v.string(),
  nom: v.string(),
  brands: v.string(),
  calories: v.union(v.number(), v.null()),
  proteines: v.union(v.number(), v.null()),
  glucides: v.union(v.number(), v.null()),
  lipides: v.union(v.number(), v.null()),
  servingSize: v.union(v.string(), v.null()),
  categoriesTags: v.array(v.string()),
  /** URL Convex storage (ou absente). Jamais un hotlink OFF. */
  imageUrl: v.optional(v.string()),
  imageStorageId: v.optional(v.string()),
  provenance: v.literal('open_food_facts'),
  fetchedAt: v.number(),
})

export async function reserveFoodSearchForUserId(
  ctx: MutationCtx,
  userId: string,
): Promise<{ allowed: boolean; searchCount: number; dailyLimit: number }> {
  const now = Date.now()
  const dateKey = toDateKey(new Date(now))
  const row = await ctx.db
    .query('food_search_usage')
    .withIndex('by_userId_dateKey', (q) => q.eq('userId', userId).eq('dateKey', dateKey))
    .first()

  if (!row) {
    await ctx.db.insert('food_search_usage', {
      userId,
      dateKey,
      searchCount: 1,
      updatedAt: now,
    })
    return { allowed: true, searchCount: 1, dailyLimit: FOOD_SEARCH_DAILY_LIMIT }
  }

  assertUserOwnership(row.userId, userId)
  if (row.searchCount >= FOOD_SEARCH_DAILY_LIMIT) {
    return {
      allowed: false,
      searchCount: row.searchCount,
      dailyLimit: FOOD_SEARCH_DAILY_LIMIT,
    }
  }
  const next = row.searchCount + 1
  await ctx.db.patch(row._id, { searchCount: next, updatedAt: now })
  return { allowed: true, searchCount: next, dailyLimit: FOOD_SEARCH_DAILY_LIMIT }
}

export const reserveFoodSearch = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({
    allowed: v.boolean(),
    searchCount: v.number(),
    dailyLimit: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const access = await assertFoodAddAccessFromStoredProfile(ctx, user.userId)
    if (!access.ok) {
      throw new Error(access.error)
    }
    return reserveFoodSearchForUserId(ctx, user.userId)
  },
})

export const getFoodSearchUsageToday = query({
  args: { sessionToken: v.string() },
  returns: v.object({
    searchCount: v.number(),
    dailyLimit: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const dateKey = toDateKey()
    const row = await ctx.db
      .query('food_search_usage')
      .withIndex('by_userId_dateKey', (q) => q.eq('userId', user.userId).eq('dateKey', dateKey))
      .first()
    return {
      searchCount: row?.searchCount ?? 0,
      dailyLimit: FOOD_SEARCH_DAILY_LIMIT,
    }
  },
})

export const upsertOffImageCache = internalMutation({
  args: {
    offCode: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = args.offCode.trim()
    if (!code) return null
    const existing = await ctx.db
      .query('off_product_images')
      .withIndex('by_offCode', (q) => q.eq('offCode', code))
      .first()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        contentType: args.contentType,
        sourceUrl: args.sourceUrl,
        updatedAt: now,
      })
      return null
    }
    await ctx.db.insert('off_product_images', {
      offCode: code,
      storageId: args.storageId,
      contentType: args.contentType,
      sourceUrl: args.sourceUrl,
      updatedAt: now,
    })
    return null
  },
})

export const getOffImageCache = internalQuery({
  args: { offCode: v.string() },
  returns: v.union(
    v.object({
      storageId: v.id('_storage'),
      url: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const code = args.offCode.trim()
    if (!code) return null
    const row = await ctx.db
      .query('off_product_images')
      .withIndex('by_offCode', (q) => q.eq('offCode', code))
      .first()
    if (!row) return null
    const url = await ctx.storage.getUrl(row.storageId)
    return { storageId: row.storageId, url }
  },
})

/** Copie une image OFF dans Convex storage (best-effort). */
export const mirrorOffImage = internalAction({
  args: {
    offCode: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.union(
    v.object({
      storageId: v.id('_storage'),
      url: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const code = args.offCode.trim()
    const sourceUrl = args.sourceUrl.trim()
    if (!code || !sourceUrl) return null
    if (!/^https:\/\/([^/]+\.)?openfoodfacts\.org\//i.test(sourceUrl)) {
      return null
    }

    const cached = await ctx.runQuery(internal.foodAdd.getOffImageCache, { offCode: code })
    if (cached?.url) return cached

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(sourceUrl, {
          signal: controller.signal,
          headers: {
            Accept: 'image/*',
            'User-Agent': OFF_USER_AGENT,
          },
        })
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      if (!contentType.startsWith('image/')) return null
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0 || buffer.byteLength > IMAGE_MAX_BYTES) return null
      const blob = new Blob([buffer], { type: contentType })
      const storageId = await ctx.storage.store(blob)
      await ctx.runMutation(internal.foodAdd.upsertOffImageCache, {
        offCode: code,
        storageId,
        contentType,
        sourceUrl,
      })
      const url = await ctx.storage.getUrl(storageId)
      return { storageId, url }
    } catch {
      return null
    }
  },
})

async function resolveOwnedImage(
  ctx: ActionCtx,
  offCode: string,
  offImageUrl: string | undefined,
): Promise<{ imageUrl?: string; imageStorageId?: string }> {
  if (!offCode) return {}
  const mirrored = offImageUrl
    ? await ctx.runAction(internal.foodAdd.mirrorOffImage, {
        offCode,
        sourceUrl: offImageUrl,
      })
    : await ctx.runQuery(internal.foodAdd.getOffImageCache, { offCode })
  if (!mirrored) return {}
  return {
    imageUrl: mirrored.url ?? undefined,
    imageStorageId: mirrored.storageId as string,
  }
}

export const searchFoods = action({
  args: {
    sessionToken: v.string(),
    term: v.string(),
    categoryTag: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    hits: v.array(foodHitValidator),
    searchCount: v.number(),
    dailyLimit: v.number(),
  }),
  handler: async (ctx, args) => {
    const quota = await ctx.runMutation(api.foodAdd.reserveFoodSearch, {
      sessionToken: args.sessionToken,
    })
    if (!quota.allowed) {
      throw new Error('FOOD_SEARCH_DAILY_LIMIT')
    }

    const term = args.term.trim()
    const categoryTag = args.categoryTag?.trim() || ''
    if (term.length < 2 && !categoryTag) {
      return { hits: [], searchCount: quota.searchCount, dailyLimit: quota.dailyLimit }
    }

    const limit = Math.max(1, Math.min(OFF_MAX_RESULTS, Math.floor(args.limit ?? OFF_MAX_RESULTS)))
    const params = new URLSearchParams()
    params.set('action', 'process')
    params.set('json', '1')
    params.set('sort_by', 'unique_scans_n')
    params.set('page_size', String(limit))
    if (term.length >= 2) {
      params.set('search_terms', term)
      params.set('search_simple', '1')
    }
    if (categoryTag) {
      params.set('tagtype_0', 'categories')
      params.set('tag_contains_0', 'contains')
      params.set('tag_0', categoryTag)
    }

    const data = (await fetchOffJson(
      `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
    )) as { products?: OffApiProduct[] }
    const products = Array.isArray(data.products) ? data.products : []
    const hits: Array<{
      barcode: string
      nom: string
      brands: string
      calories: number | null
      proteines: number | null
      glucides: number | null
      lipides: number | null
      servingSize: string | null
      categoriesTags: string[]
      imageUrl?: string
      imageStorageId?: string
      provenance: 'open_food_facts'
      fetchedAt: number
    }> = []

    for (const product of products) {
      const mapped = mapOffProduct(product, String(product.code || product._id || ''))
      if (!mapped.nom.trim()) continue
      // Images : on copie chez nous (best-effort, séquentiel limité).
      let imageUrl: string | undefined
      let imageStorageId: string | undefined
      if (hits.length < 8) {
        const owned = await resolveOwnedImage(ctx, mapped.barcode, mapped.offImageUrl)
        imageUrl = owned.imageUrl
        imageStorageId = owned.imageStorageId
      } else if (mapped.barcode) {
        const cached = await ctx.runQuery(internal.foodAdd.getOffImageCache, {
          offCode: mapped.barcode,
        })
        if (cached?.url) {
          imageUrl = cached.url
          imageStorageId = cached.storageId as string
        }
      }
      hits.push({
        barcode: mapped.barcode,
        nom: mapped.nom,
        brands: mapped.brands,
        calories: mapped.calories,
        proteines: mapped.proteines,
        glucides: mapped.glucides,
        lipides: mapped.lipides,
        servingSize: mapped.servingSize,
        categoriesTags: mapped.categoriesTags,
        imageUrl,
        imageStorageId,
        provenance: 'open_food_facts',
        fetchedAt: mapped.fetchedAt,
      })
      if (hits.length >= limit) break
    }

    return { hits, searchCount: quota.searchCount, dailyLimit: quota.dailyLimit }
  },
})

/**
 * Ajoute un snapshot aliment au journal — refuse mineur / TCA côté serveur.
 * Stocke name, portion, offCode, image ref, updatedAt (jamais juste un lien).
 */
export const addFoodSnapshot = mutation({
  args: {
    sessionToken: v.string(),
    mealId: v.string(),
    dateKey: v.string(),
    mealType: v.string(),
    name: v.string(),
    portionLabel: v.string(),
    offCode: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    calories: v.union(v.number(), v.null()),
    proteinG: v.optional(v.union(v.number(), v.null())),
    carbsG: v.optional(v.union(v.number(), v.null())),
    fatG: v.optional(v.union(v.number(), v.null())),
    grams: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const access = await assertFoodAddAccessFromStoredProfile(ctx, user.userId)
    if (!access.ok) {
      throw new Error(access.error)
    }

    const userId = user.userId
    const nextUpdatedAt = args.updatedAt ?? Date.now()
    const existing = await ctx.db
      .query('nutrition_meals')
      .withIndex('by_userId_mealId', (q) => q.eq('userId', userId).eq('mealId', args.mealId))
      .first()

    const patch = {
      dateKey: normalizeDateKey(args.dateKey),
      mealType: args.mealType.trim().slice(0, 24),
      name: mealName(args.name),
      calories: args.calories,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      grams: args.grams,
      portionLabel: args.portionLabel.trim().slice(0, 80) || 'pour 100 g',
      offCode: args.offCode?.trim() || undefined,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      updatedAt: nextUpdatedAt,
      deletedAt: undefined as number | undefined,
    }

    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > nextUpdatedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, patch)
      return { applied: true, stale: false, updatedAt: nextUpdatedAt }
    }

    await ctx.db.insert('nutrition_meals', {
      userId,
      mealId: args.mealId,
      ...patch,
      createdAt: args.createdAt ?? nextUpdatedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })

    // Catalog snapshot (recent / offline sync).
    if (args.offCode?.trim() || args.name.trim()) {
      const foodKey = normalizeFoodKey({
        barcode: args.offCode,
        name: args.name,
      })
      const catalog = await ctx.db
        .query('nutrition_food_catalog')
        .withIndex('by_userId_foodKey', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
        .first()
      const catalogPatch = {
        barcode: args.offCode?.trim() || undefined,
        name: mealName(args.name),
        caloriesPer100g: args.calories,
        proteinPer100g: args.proteinG ?? null,
        carbsPer100g: args.carbsG ?? null,
        fatPer100g: args.fatG ?? null,
        imageUrl: args.imageUrl,
        imageStorageId: args.imageStorageId,
        servingSize: null as string | null,
        portionLabel: patch.portionLabel,
        lastFetchedAt: nextUpdatedAt,
        lastSelectedAt: nextUpdatedAt,
        updatedAt: nextUpdatedAt,
      }
      if (catalog) {
        assertUserOwnership(catalog.userId, userId)
        await ctx.db.patch(catalog._id, {
          ...catalogPatch,
          selectedCount: (catalog.selectedCount ?? 0) + 1,
        })
      } else {
        await ctx.db.insert('nutrition_food_catalog', {
          userId,
          foodKey,
          ...catalogPatch,
          source: 'open_food_facts',
          selectedCount: 1,
          isFavorite: false,
          schemaVersion: NUTRITION_SCHEMA_VERSION,
        })
      }
    }

    return { applied: true, stale: false, updatedAt: nextUpdatedAt }
  },
})

/** Exposé pour tests unitaires (sans Convex runtime). */
export const __test = {
  mapOffProduct,
  FOOD_SEARCH_DAILY_LIMIT,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
  toDateKey,
}
