/**
 * « Ajouter un aliment » v3 — recherche OFF via Convex (jamais depuis le téléphone),
 * limite journalière, images copiées dans notre storage, snapshot à l’ajout,
 * garde mineur / TCA.
 *
 * Ne pas déployer depuis ce dépôt — le Studio Manager gère Convex prod.
 */
import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
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
import {
  computeMealNutritionFromOffCache,
  parseServingGrams,
  type OffProductNutrientCache,
} from './lib/foodAddNutrients'
import {
  FOOD_ADD_QUANTITY_INVALID,
  formatGramsCountLabel,
  formatPiecesCountLabel,
  parsePortionGrams,
  validateFoodQuantity,
} from './lib/foodAddQuantity'
import {
  catalogNutrientForV3Meal,
  pickCatalogNutrient,
} from './lib/foodAddUpsertSanitize'
import {
  buildOffSearchUrl,
  fetchOffSearchJson,
  OFF_SEARCH_PAGE_SIZE,
  OFF_SEARCH_RETURN_LIMIT,
  OFF_SEARCH_TIMEOUT_MS,
  OFF_SEARCH_USER_AGENT,
  pickOffSearchProducts,
} from './lib/offSearch'

/** Toutes les erreurs FOOD_ADD_* passent par ConvexError (data.code visible en prod). */
function throwFoodAddError(data: {
  code: string
  reason?: string
  unit?: 'g' | 'pieces'
}): never {
  throw new ConvexError(data)
}

const OFF_USER_AGENT = OFF_SEARCH_USER_AGENT
/** Miroir image (hors recherche) — inchangé. */
const OFF_TIMEOUT_MS = OFF_SEARCH_TIMEOUT_MS
const OFF_MAX_RESULTS = OFF_SEARCH_RETURN_LIMIT
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
  countries_tags?: string[]
  unique_scans_n?: number
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
    throwFoodAddError({ code: 'FOOD_ADD_IMAGE_NOT_OWNED' })
  }
  if (!storageId) {
    throwFoodAddError({ code: 'FOOD_ADD_IMAGE_NOT_OWNED' })
  }
}

/**
 * Quantité addFoodSnapshot — toujours valider si grams/pieces présent (même -5/0/NaN).
 * Ni l’un ni l’autre → below_min. portionLabel grams écrit côté serveur uniquement.
 */
export function resolveAddFoodSnapshotQuantity(input: {
  grams?: number
  pieces?: number
  servingGrams?: number | null
}): {
  storeGrams: number | undefined
  storePieces: number | undefined
  portionLabel: string
} {
  const piecesPresent = input.pieces !== undefined
  const gramsPresent = input.grams !== undefined

  if (!piecesPresent && !gramsPresent) {
    throwFoodAddError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: 'below_min',
    })
  }

  if (piecesPresent) {
    const qty = validateFoodQuantity({
      unit: 'pieces',
      value: input.pieces,
      servingGrams: input.servingGrams ?? null,
    })
    if (!qty.ok || qty.unit !== 'pieces') {
      throwFoodAddError({
        code: FOOD_ADD_QUANTITY_INVALID,
        reason: !qty.ok ? qty.reason : 'invalid',
        unit: 'pieces',
      })
    }
    const n = qty.pieces
    const sg = input.servingGrams
    const storeGrams =
      typeof sg === 'number' && Number.isFinite(sg) && sg > 0 ? n * sg : undefined
    return {
      storeGrams,
      storePieces: n,
      portionLabel: formatPiecesCountLabel(n),
    }
  }

  const qty = validateFoodQuantity({ unit: 'g', value: input.grams })
  if (!qty.ok || qty.unit !== 'g') {
    throwFoodAddError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: !qty.ok ? qty.reason : 'invalid',
      unit: 'g',
    })
  }
  return {
    storeGrams: qty.grams,
    storePieces: undefined,
    // Jamais le texte client — libellé serveur depuis la quantité validée.
    portionLabel: formatGramsCountLabel(qty.grams),
  }
}

async function fetchOffJson(url: string): Promise<unknown> {
  return fetchOffSearchJson(url, { timeoutMs: OFF_SEARCH_TIMEOUT_MS, retries: 1 })
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
      throwFoodAddError({ code: access.error })
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

/** Upsert nutriments OFF (per 100 g + poids portion) — clé offCode. */
export const upsertOffProductNutrients = internalMutation({
  args: {
    offCode: v.string(),
    caloriesPer100g: v.union(v.number(), v.null()),
    proteinPer100g: v.union(v.number(), v.null()),
    carbsPer100g: v.union(v.number(), v.null()),
    fatPer100g: v.union(v.number(), v.null()),
    servingSize: v.union(v.string(), v.null()),
    servingGrams: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = args.offCode.trim()
    if (!code) return null
    const existing = await ctx.db
      .query('off_product_nutrients')
      .withIndex('by_offCode', (q) => q.eq('offCode', code))
      .first()
    const now = Date.now()
    const patch = {
      caloriesPer100g: args.caloriesPer100g,
      proteinPer100g: args.proteinPer100g,
      carbsPer100g: args.carbsPer100g,
      fatPer100g: args.fatPer100g,
      servingSize: args.servingSize,
      servingGrams: args.servingGrams,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return null
    }
    await ctx.db.insert('off_product_nutrients', {
      offCode: code,
      ...patch,
    })
    return null
  },
})

async function loadOffProductNutrients(
  ctx: MutationCtx,
  offCode: string | undefined,
): Promise<OffProductNutrientCache | null> {
  const code = offCode?.trim()
  if (!code) return null
  const row = await ctx.db
    .query('off_product_nutrients')
    .withIndex('by_offCode', (q) => q.eq('offCode', code))
    .first()
  if (!row) return null
  return {
    caloriesPer100g: row.caloriesPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatPer100g: row.fatPer100g,
    servingSize: row.servingSize ?? null,
    servingGrams: row.servingGrams,
  }
}

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
    // Demande large à OFF, re-tri pertinence, renvoie `limit`.
    const url = buildOffSearchUrl({
      term,
      categoryTag: categoryTag || null,
      pageSize: OFF_SEARCH_PAGE_SIZE,
    })

    let data: { products?: OffApiProduct[] }
    try {
      data = (await fetchOffJson(url)) as { products?: OffApiProduct[] }
    } catch (error) {
      // Jamais de liste vide sur erreur réseau — le client affiche un message clair.
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`FOOD_SEARCH_NETWORK:${message}`)
    }
    const products = Array.isArray(data.products) ? data.products : []
    const ranked = pickOffSearchProducts(term, products, limit)
    const hits: FoodAddV3PublicHit[] = []

    for (const product of ranked) {
      const mapped = mapOffProduct(product, String(product.code || product._id || ''))
      if (!mapped.nom.trim()) continue
      // Recherche : cache image seulement — pas de mirror séquentiel (cause timeouts → 0 résultat).
      // Le miroir OFF → storage reste disponible ailleurs (barcode / mirrorOffImage).
      let imageUrl: string | undefined
      let imageStorageId: string | undefined
      if (mapped.barcode) {
        const cached: OwnedImageRef | null = await ctx.runQuery(internal.foodAdd.getOffImageCache, {
          offCode: mapped.barcode,
        })
        if (cached?.url) {
          imageUrl = cached.url
          imageStorageId = cached.storageId
        }
      }
      if (mapped.barcode) {
        await ctx.runMutation(internal.foodAdd.upsertOffProductNutrients, {
          offCode: mapped.barcode,
          caloriesPer100g: mapped.calories,
          proteinPer100g: mapped.proteines,
          carbsPer100g: mapped.glucides,
          fatPer100g: mapped.lipides,
          servingSize: mapped.servingSize,
          servingGrams: parseServingGrams(mapped.servingSize),
        })
      }
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
 * kcal/macros : calculés serveur depuis off_product_nutrients + grams/pieces.
 * Les args calories/proteinG/carbsG/fatG client sont optionnels et jamais lus.
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
    /** Ignoré — conservé optionnel pour compat clients ; jamais lu. */
    calories: v.optional(v.union(v.number(), v.null())),
    proteinG: v.optional(v.union(v.number(), v.null())),
    carbsG: v.optional(v.union(v.number(), v.null())),
    fatG: v.optional(v.union(v.number(), v.null())),
    grams: v.optional(v.number()),
    pieces: v.optional(v.number()),
    servingSize: v.optional(v.union(v.string(), v.null())),
    /** Id stable par ajout (retries) — selectedCount +1 seulement à la création. */
    selectionEventId: v.optional(v.string()),
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
      throwFoodAddError({ code: access.error })
    }

    assertOwnedImageArgs({
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
    })

    let ownedImageUrl = args.imageUrl
    let ownedStorageId = args.imageStorageId
    if (ownedStorageId) {
      const url = await ctx.storage.getUrl(ownedStorageId)
      if (!url) throwFoodAddError({ code: 'FOOD_ADD_IMAGE_NOT_OWNED' })
      ownedImageUrl = url
    }

    const userId = user.userId
    const nextUpdatedAt = args.updatedAt ?? Date.now()
    const existing = await ctx.db
      .query('nutrition_meals')
      .withIndex('by_userId_mealId', (q) => q.eq('userId', userId).eq('mealId', args.mealId))
      .first()

    // Jamais lire args.calories / proteinG / carbsG / fatG — calcul serveur seul.
    void args.calories
    void args.proteinG
    void args.carbsG
    void args.fatG
    // portionLabel client ignoré en mode grams — le serveur l’écrit (A2).
    void args.portionLabel

    const nutrientCache = await loadOffProductNutrients(ctx, args.offCode)

    const foodKey =
      args.offCode?.trim() || args.name.trim()
        ? normalizeFoodKey({ barcode: args.offCode, name: args.name })
        : null
    const catalog = foodKey
      ? await ctx.db
          .query('nutrition_food_catalog')
          .withIndex('by_userId_foodKey', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
          .first()
      : null

    // PC-04 : catalogue seulement si nutrientsSource === 'server' (jamais client 9999).
    const catalogSrc = catalog?.nutrientsSource
    const nutrientForMeal: OffProductNutrientCache | null =
      nutrientCache || (catalog && catalogSrc === 'server')
        ? {
            caloriesPer100g: catalogNutrientForV3Meal(
              nutrientCache?.caloriesPer100g,
              catalog?.caloriesPer100g,
              catalogSrc,
            ),
            proteinPer100g: catalogNutrientForV3Meal(
              nutrientCache?.proteinPer100g,
              catalog?.proteinPer100g,
              catalogSrc,
            ),
            carbsPer100g: catalogNutrientForV3Meal(
              nutrientCache?.carbsPer100g,
              catalog?.carbsPer100g,
              catalogSrc,
            ),
            fatPer100g: catalogNutrientForV3Meal(
              nutrientCache?.fatPer100g,
              catalog?.fatPer100g,
              catalogSrc,
            ),
            servingSize:
              nutrientCache?.servingSize ??
              (catalogSrc === 'server' ? catalog?.servingSize ?? null : null),
            servingGrams:
              nutrientCache?.servingGrams ??
              (catalogSrc === 'server'
                ? parseServingGrams(catalog?.servingSize ?? null)
                : null),
          }
        : nutrientCache
          ? nutrientCache
          : null

    const { storeGrams, storePieces, portionLabel } = resolveAddFoodSnapshotQuantity({
      grams: args.grams,
      pieces: args.pieces,
      servingGrams: nutrientForMeal?.servingGrams ?? null,
    })

    const computed = computeMealNutritionFromOffCache(nutrientForMeal, {
      grams: storeGrams,
      pieces: storePieces != null && storeGrams == null ? storePieces : undefined,
    })

    const selectionEventId = args.selectionEventId?.trim() || undefined

    const patch = {
      dateKey: normalizeDateKey(args.dateKey),
      mealType: args.mealType.trim().slice(0, 24),
      name: mealName(args.name),
      calories: computed.calories,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      grams: storeGrams,
      pieces: storePieces,
      portionLabel,
      offCode: args.offCode?.trim() || undefined,
      imageUrl: ownedImageUrl,
      imageStorageId: ownedStorageId,
      entrySource: 'v3' as const,
      selectionEventId: selectionEventId ?? existing?.selectionEventId,
      updatedAt: nextUpdatedAt,
      deletedAt: undefined as number | undefined,
    }

    const isNewMeal = !existing
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > nextUpdatedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert('nutrition_meals', {
        userId,
        mealId: args.mealId,
        ...patch,
        createdAt: args.createdAt ?? nextUpdatedAt,
        schemaVersion: NUTRITION_SCHEMA_VERSION,
      })
    }

    if (foodKey) {
      // Catalogue : OFF d’abord. Sinon B3-02 — ne jamais écraser des valeurs client
      // connues par null (aliments récents V3 OFF). Toujours nutrientsSource client
      // si pas OFF → jamais lu pour kcal repas V3 (A1).
      const servingSize =
        typeof args.servingSize === 'string'
          ? args.servingSize.trim() || null
          : (nutrientCache?.servingSize ?? catalog?.servingSize ?? null)
      const hasOff = Boolean(nutrientCache)
      const keepClientCatalog =
        !hasOff &&
        catalog &&
        (catalog.nutrientsSource === 'client' || catalog.nutrientsSource == null)
      const catalogPatch = {
        barcode: args.offCode?.trim() || undefined,
        name: mealName(args.name),
        caloriesPer100g: hasOff
          ? pickCatalogNutrient(nutrientCache?.caloriesPer100g, null)
          : keepClientCatalog
            ? pickCatalogNutrient(null, catalog.caloriesPer100g)
            : catalog?.nutrientsSource === 'server'
              ? pickCatalogNutrient(null, catalog.caloriesPer100g)
              : null,
        proteinPer100g: hasOff
          ? pickCatalogNutrient(nutrientCache?.proteinPer100g, null)
          : keepClientCatalog
            ? pickCatalogNutrient(null, catalog.proteinPer100g)
            : catalog?.nutrientsSource === 'server'
              ? pickCatalogNutrient(null, catalog.proteinPer100g)
              : null,
        carbsPer100g: hasOff
          ? pickCatalogNutrient(nutrientCache?.carbsPer100g, null)
          : keepClientCatalog
            ? pickCatalogNutrient(null, catalog.carbsPer100g)
            : catalog?.nutrientsSource === 'server'
              ? pickCatalogNutrient(null, catalog.carbsPer100g)
              : null,
        fatPer100g: hasOff
          ? pickCatalogNutrient(nutrientCache?.fatPer100g, null)
          : keepClientCatalog
            ? pickCatalogNutrient(null, catalog.fatPer100g)
            : catalog?.nutrientsSource === 'server'
              ? pickCatalogNutrient(null, catalog.fatPer100g)
              : null,
        nutrientsSource: hasOff
          ? ('server' as const)
          : catalog?.nutrientsSource === 'server'
            ? ('server' as const)
            : keepClientCatalog
              ? ('client' as const)
              : catalog?.nutrientsSource === 'client'
                ? ('client' as const)
                : catalog?.nutrientsSource,
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
        // PC-09 : selectedCount +1 seulement à la création du repas.
        await ctx.db.patch(catalog._id, {
          ...catalogPatch,
          selectedCount: isNewMeal
            ? (catalog.selectedCount ?? 0) + 1
            : catalog.selectedCount,
        })
      } else if (isNewMeal) {
        await ctx.db.insert('nutrition_food_catalog', {
          userId,
          foodKey,
          ...catalogPatch,
          nutrientsSource: hasOff ? 'server' : undefined,
          source: args.offCode?.trim() ? 'open_food_facts' : 'manual',
          selectedCount: 1,
          isFavorite: false,
          schemaVersion: NUTRITION_SCHEMA_VERSION,
        })
      }
    }

    return { applied: true, stale: false, updatedAt: nextUpdatedAt }
  },
})

/** Réexport — off d’abord, catalog (y compris 0), sinon null. */
export { pickCatalogNutrient }

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
  resolveAddFoodSnapshotQuantity,
  throwFoodAddError,
  pickCatalogNutrient,
  FOOD_SEARCH_DAILY_LIMIT,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
  FOOD_ADD_QUANTITY_INVALID,
  toDateKey,
  formatPortionLabelFromServing,
  parseServingGrams,
  parsePortionGrams,
  computeMealNutritionFromOffCache,
  validateFoodQuantity,
  formatPiecesCountLabel,
  formatGramsCountLabel,
}
