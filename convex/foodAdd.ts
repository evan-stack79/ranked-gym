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
import {
  formatPortionLabelFromServing,
  toFoodAddV3PublicHit,
  toFoodAddV3PublicMeal,
  type FoodAddV3PublicHit,
} from './lib/foodAddPublic'

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

type OwnedImageRef = {
  storageId: Id<'_storage'>
  url: string | null
}

/** Hit interne OFF (avec nutriments pour stockage serveur uniquement). */
type FoodHitInternal = {
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
}

type FoodSearchQuota = {
  allowed: boolean
  searchCount: number
  dailyLimit: number
}

/** Réponse app-facing V3 — jamais de kcal / macros. */
type SearchFoodsResult = {
  hits: FoodAddV3PublicHit[]
  searchCount: number
  dailyLimit: number
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

/** Accepte uniquement une image hébergée chez nous (storageId Convex). */
export function assertOwnedImageArgs(input: {
  imageUrl?: string
  imageStorageId?: Id<'_storage'>
}): void {
  const url = input.imageUrl?.trim()
  const storageId = input.imageStorageId
  if (!url && !storageId) return
  if (url && /openfoodfacts\.org/i.test(url)) {
    throw new Error('FOOD_ADD_IMAGE_NOT_OWNED')
  }
  if (!storageId) {
    throw new Error('FOOD_ADD_IMAGE_NOT_OWNED')
  }
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

/** Validateur app-facing V3 — name / portion / ids uniquement. */
const foodHitPublicValidator = v.object({
  barcode: v.string(),
  nom: v.string(),
  brands: v.string(),
  servingSize: v.union(v.string(), v.null()),
  portionLabel: v.string(),
  categoriesTags: v.array(v.string()),
  imageUrl: v.optional(v.string()),
  imageStorageId: v.optional(v.string()),
  provenance: v.literal('open_food_facts'),
  fetchedAt: v.number(),
})

export async function reserveFoodSearchForUserId(
  ctx: MutationCtx,
  userId: string,
): Promise<FoodSearchQuota> {
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
  handler: async (ctx, args): Promise<FoodSearchQuota> => {
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
  handler: async (ctx, args): Promise<OwnedImageRef | null> => {
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
  handler: async (ctx, args): Promise<OwnedImageRef | null> => {
    const code = args.offCode.trim()
    const sourceUrl = args.sourceUrl.trim()
    if (!code || !sourceUrl) return null
    if (!/^https:\/\/([^/]+\.)?openfoodfacts\.org\//i.test(sourceUrl)) {
      return null
    }

    const cached: OwnedImageRef | null = await ctx.runQuery(internal.foodAdd.getOffImageCache, {
      offCode: code,
    })
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
      const storageId: Id<'_storage'> = await ctx.storage.store(blob)
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
  const mirrored: OwnedImageRef | null = offImageUrl
    ? await ctx.runAction(internal.foodAdd.mirrorOffImage, {
        offCode,
        sourceUrl: offImageUrl,
      })
    : await ctx.runQuery(internal.foodAdd.getOffImageCache, { offCode })
  if (!mirrored) return {}
  return {
    imageUrl: mirrored.url ?? undefined,
    imageStorageId: mirrored.storageId,
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
    hits: v.array(foodHitPublicValidator),
    searchCount: v.number(),
    dailyLimit: v.number(),
  }),
  handler: async (ctx, args): Promise<SearchFoodsResult> => {
    const term = args.term.trim()
    const categoryTag = args.categoryTag?.trim() || ''
    // Ne consomme pas le quota pour une requête vide.
    if (term.length < 2 && !categoryTag) {
      return { hits: [], searchCount: 0, dailyLimit: FOOD_SEARCH_DAILY_LIMIT }
    }

    const quota: FoodSearchQuota = await ctx.runMutation(api.foodAdd.reserveFoodSearch, {
      sessionToken: args.sessionToken,
    })
    if (!quota.allowed) {
      throw new Error('FOOD_SEARCH_DAILY_LIMIT')
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
    const hits: FoodAddV3PublicHit[] = []

    for (const product of products) {
      const mapped = mapOffProduct(product, String(product.code || product._id || ''))
      if (!mapped.nom.trim()) continue
      let imageUrl: string | undefined
      let imageStorageId: string | undefined
      if (hits.length < 8) {
        const owned = await resolveOwnedImage(ctx, mapped.barcode, mapped.offImageUrl)
        imageUrl = owned.imageUrl
        imageStorageId = owned.imageStorageId
      } else if (mapped.barcode) {
        const cached: OwnedImageRef | null = await ctx.runQuery(internal.foodAdd.getOffImageCache, {
          offCode: mapped.barcode,
        })
        if (cached?.url) {
          imageUrl = cached.url
          imageStorageId = cached.storageId
        }
      }
      // Nutriments lus côté serveur pour stockage ultérieur ; non renvoyés à l’app.
      void (mapped as FoodHitInternal)
      hits.push(
        toFoodAddV3PublicHit({
          barcode: mapped.barcode,
          nom: mapped.nom,
          brands: mapped.brands,
          servingSize: mapped.servingSize,
          categoriesTags: mapped.categoriesTags,
          imageUrl,
          imageStorageId,
          provenance: 'open_food_facts',
          fetchedAt: mapped.fetchedAt,
        }),
      )
      if (hits.length >= limit) break
    }

    return { hits, searchCount: quota.searchCount, dailyLimit: quota.dailyLimit }
  },
})

/**
 * Ajoute un snapshot aliment au journal — refuse mineur / TCA côté serveur.
 * Stocke name, portion, offCode, image ref, updatedAt (jamais juste un lien).
 * imageUrl / imageStorageId : uniquement nos refs Convex.
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
    servingSize: v.optional(v.union(v.string(), v.null())),
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

    assertOwnedImageArgs({
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
    })

    let ownedImageUrl = args.imageUrl
    let ownedStorageId = args.imageStorageId
    if (ownedStorageId) {
      const url = await ctx.storage.getUrl(ownedStorageId)
      if (!url) throw new Error('FOOD_ADD_IMAGE_NOT_OWNED')
      ownedImageUrl = url
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
      imageUrl: ownedImageUrl,
      imageStorageId: ownedStorageId,
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

    if (args.offCode?.trim() || args.name.trim()) {
      const foodKey = normalizeFoodKey({
        barcode: args.offCode,
        name: args.name,
      })
      const catalog = await ctx.db
        .query('nutrition_food_catalog')
        .withIndex('by_userId_foodKey', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
        .first()
      const servingSize =
        typeof args.servingSize === 'string' ? args.servingSize.trim() || null : null
      const catalogPatch = {
        barcode: args.offCode?.trim() || undefined,
        name: mealName(args.name),
        caloriesPer100g: args.calories,
        proteinPer100g: args.proteinG ?? null,
        carbsPer100g: args.carbsG ?? null,
        fatPer100g: args.fatG ?? null,
        imageUrl: ownedImageUrl,
        imageStorageId: ownedStorageId,
        servingSize,
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

/**
 * Journal V3 app-facing — name / quantité / unité (+ ids, timestamps).
 * Ne remplace pas listJournalEntries (legacy V3-OFF inchangé).
 */
export const listJournalEntriesV3 = query({
  args: {
    sessionToken: v.string(),
    startDateKey: v.optional(v.string()),
    endDateKey: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.object({
    meals: v.array(
      v.object({
        mealId: v.string(),
        dateKey: v.optional(v.string()),
        mealType: v.optional(v.string()),
        name: v.optional(v.string()),
        grams: v.optional(v.number()),
        pieces: v.optional(v.number()),
        portionLabel: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        imageStorageId: v.optional(v.string()),
        offCode: v.optional(v.string()),
        createdAt: v.optional(v.number()),
        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const includeDeleted = Boolean(args.includeDeleted)
    const startDateKey = args.startDateKey ? normalizeDateKey(args.startDateKey) : undefined
    const endDateKey = args.endDateKey ? normalizeDateKey(args.endDateKey) : undefined

    const mealRows = await ctx.db
      .query('nutrition_meals')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', user.userId))
      .collect()

    const meals = mealRows
      .filter((row) => {
        if (!includeDeleted && row.deletedAt) return false
        if (row.dateKey == null) {
          return includeDeleted && !startDateKey && !endDateKey
        }
        if (startDateKey && row.dateKey < startDateKey) return false
        if (endDateKey && row.dateKey > endDateKey) return false
        return true
      })
      .map((row) => {
        assertUserOwnership(row.userId, user.userId)
        if (row.deletedAt != null && row.name == null && row.dateKey == null) {
          return toFoodAddV3PublicMeal({
            mealId: row.mealId,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
          })
        }
        return toFoodAddV3PublicMeal({
          mealId: row.mealId,
          dateKey: row.dateKey,
          mealType: row.mealType,
          name: row.name,
          grams: row.grams,
          pieces: row.pieces,
          portionLabel: row.portionLabel,
          imageUrl: row.imageUrl,
          imageStorageId: row.imageStorageId,
          offCode: row.offCode,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        })
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return { meals }
  },
})

/** Exposé pour tests unitaires (sans Convex runtime). */
export const __test = {
  mapOffProduct,
  assertOwnedImageArgs,
  FOOD_SEARCH_DAILY_LIMIT,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
  toDateKey,
  formatPortionLabelFromServing,
}
