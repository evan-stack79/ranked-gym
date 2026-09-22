import { v } from 'convex/values'
import { api } from './_generated/api'
import {
  action,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

const NUTRITION_SCHEMA_VERSION = 1
const DEFAULT_OFF_TIMEOUT_MS = 8_000
const OFF_MAX_RESULTS = 20
const OFF_USER_AGENT = 'RankedGym/1.0 (support@rankedgym.app)'

type SessionCtx = QueryCtx | MutationCtx

type OffApiProduct = {
  code?: string
  _id?: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  image_front_small_url?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    energy_kcal_100g?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
}

function normalizeDateKey(value: string): string {
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('NUTRITION_DATEKEY_INVALID')
  }
  return normalized
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

function withinDateRange(dateKey: string, startDateKey?: string, endDateKey?: string): boolean {
  if (startDateKey && dateKey < startDateKey) return false
  if (endDateKey && dateKey > endDateKey) return false
  return true
}

async function sessionUserId(ctx: SessionCtx, sessionToken: string): Promise<string> {
  const user = await requireSessionUser(ctx, sessionToken)
  return user.userId
}

async function assertActionSession(ctx: ActionCtx, sessionToken: string): Promise<void> {
  const session = await ctx.runQuery(api.auth.getSession, { sessionToken })
  if (!session) throw new Error('Not authenticated')
}

async function findMealRow(ctx: SessionCtx, userId: string, mealId: string) {
  return ctx.db
    .query('nutrition_meals')
    .withIndex('by_userId_mealId', (q) => q.eq('userId', userId).eq('mealId', mealId))
    .first()
}

async function findWaterRow(ctx: SessionCtx, userId: string, entryId: string) {
  return ctx.db
    .query('nutrition_water_entries')
    .withIndex('by_userId_entryId', (q) => q.eq('userId', userId).eq('entryId', entryId))
    .first()
}

async function findDayStateRow(ctx: SessionCtx, userId: string, dateKey: string) {
  return ctx.db
    .query('nutrition_day_state')
    .withIndex('by_userId_dateKey', (q) => q.eq('userId', userId).eq('dateKey', dateKey))
    .first()
}

async function findFoodRow(ctx: SessionCtx, userId: string, foodKey: string) {
  return ctx.db
    .query('nutrition_food_catalog')
    .withIndex('by_userId_foodKey', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
    .first()
}

async function fetchOffJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_OFF_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_USER_AGENT,
        From: 'support@rankedgym.app',
      },
    })
    if (!response.ok) {
      throw new Error(`OFF_HTTP_${response.status}`)
    }
    return (await response.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

function mapOffProduct(raw: OffApiProduct, fallbackBarcode: string) {
  const nutriments = raw.nutriments ?? {}
  const calories = asNullableNumber(nutriments['energy-kcal_100g'] ?? nutriments.energy_kcal_100g)
  const proteines = asNullableNumber(nutriments.proteins_100g)
  const glucides = asNullableNumber(nutriments.carbohydrates_100g)
  const lipides = asNullableNumber(nutriments.fat_100g)
  const barcode = String(raw.code || raw._id || fallbackBarcode).trim()
  const nom =
    raw.product_name_fr?.trim() ||
    raw.product_name?.trim() ||
    (barcode ? `Produit ${barcode}` : 'Produit')
  return {
    barcode,
    nom,
    brands: raw.brands?.trim() || '',
    calories,
    proteines,
    glucides,
    lipides,
    imageUrl: raw.image_front_small_url,
    provenance: 'open_food_facts' as const,
    fetchedAt: Date.now(),
  }
}

const mealValidator = v.object({
  mealId: v.string(),
  dateKey: v.string(),
  mealType: v.string(),
  name: v.string(),
  calories: v.union(v.number(), v.null()),
  proteinG: v.optional(v.union(v.number(), v.null())),
  carbsG: v.optional(v.union(v.number(), v.null())),
  fatG: v.optional(v.union(v.number(), v.null())),
  grams: v.optional(v.number()),
  pieces: v.optional(v.number()),
  portionMode: v.optional(v.union(v.literal('solo'), v.literal('with_sides'))),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})

const waterValidator = v.object({
  entryId: v.string(),
  dateKey: v.string(),
  amountMl: v.number(),
  type: v.string(),
  label: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})

const dayStateValidator = v.object({
  dateKey: v.string(),
  waterBottleLevelMl: v.optional(v.union(v.number(), v.null())),
  waterBottleCalibrationTotalMl: v.optional(v.union(v.number(), v.null())),
  updatedAt: v.number(),
})

const foodValidator = v.object({
  foodKey: v.string(),
  barcode: v.optional(v.string()),
  name: v.string(),
  brand: v.optional(v.string()),
  caloriesPer100g: v.union(v.number(), v.null()),
  proteinPer100g: v.union(v.number(), v.null()),
  carbsPer100g: v.union(v.number(), v.null()),
  fatPer100g: v.union(v.number(), v.null()),
  imageUrl: v.optional(v.string()),
  source: v.union(
    v.literal('open_food_facts'),
    v.literal('manual'),
    v.literal('ai_photo'),
    v.literal('supabase_import'),
  ),
  lastFetchedAt: v.number(),
  lastSelectedAt: v.number(),
  selectedCount: v.number(),
  isFavorite: v.boolean(),
  lastUsedMealType: v.optional(v.string()),
  updatedAt: v.number(),
})

export const upsertMeal = mutation({
  args: {
    sessionToken: v.string(),
    mealId: v.string(),
    dateKey: v.string(),
    mealType: v.string(),
    name: v.string(),
    calories: v.union(v.number(), v.null()),
    proteinG: v.optional(v.union(v.number(), v.null())),
    carbsG: v.optional(v.union(v.number(), v.null())),
    fatG: v.optional(v.union(v.number(), v.null())),
    grams: v.optional(v.number()),
    pieces: v.optional(v.number()),
    portionMode: v.optional(v.union(v.literal('solo'), v.literal('with_sides'))),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const existing = await findMealRow(ctx, userId, args.mealId)
    const nextUpdatedAt = args.updatedAt ?? Date.now()
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > nextUpdatedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, {
        dateKey: normalizeDateKey(args.dateKey),
        mealType: args.mealType.trim().slice(0, 24),
        name: mealName(args.name),
        calories: args.calories,
        proteinG: args.proteinG,
        carbsG: args.carbsG,
        fatG: args.fatG,
        grams: args.grams,
        pieces: args.pieces,
        portionMode: args.portionMode,
        updatedAt: nextUpdatedAt,
        deletedAt: undefined,
      })
      return { applied: true, stale: false, updatedAt: nextUpdatedAt }
    }

    await ctx.db.insert('nutrition_meals', {
      userId,
      mealId: args.mealId,
      dateKey: normalizeDateKey(args.dateKey),
      mealType: args.mealType.trim().slice(0, 24),
      name: mealName(args.name),
      calories: args.calories,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      grams: args.grams,
      pieces: args.pieces,
      portionMode: args.portionMode,
      createdAt: args.createdAt ?? nextUpdatedAt,
      updatedAt: nextUpdatedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, stale: false, updatedAt: nextUpdatedAt }
  },
})

export const deleteMeal = mutation({
  args: {
    sessionToken: v.string(),
    mealId: v.string(),
    dateKey: v.string(),
    deletedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const deletedAt = args.deletedAt ?? Date.now()
    const existing = await findMealRow(ctx, userId, args.mealId)
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > deletedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, {
        deletedAt,
        updatedAt: deletedAt,
      })
      return { applied: true, stale: false, updatedAt: deletedAt }
    }
    await ctx.db.insert('nutrition_meals', {
      userId,
      mealId: args.mealId,
      dateKey: normalizeDateKey(args.dateKey),
      mealType: 'deleted',
      name: 'deleted',
      calories: null,
      createdAt: deletedAt,
      updatedAt: deletedAt,
      deletedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, stale: false, updatedAt: deletedAt }
  },
})

export const upsertWaterEntry = mutation({
  args: {
    sessionToken: v.string(),
    entryId: v.string(),
    dateKey: v.string(),
    amountMl: v.number(),
    type: v.string(),
    label: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const existing = await findWaterRow(ctx, userId, args.entryId)
    const nextUpdatedAt = args.updatedAt ?? Date.now()
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > nextUpdatedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, {
        dateKey: normalizeDateKey(args.dateKey),
        amountMl: Math.max(0, Math.round(args.amountMl)),
        type: args.type.trim().slice(0, 32),
        label: args.label.trim().slice(0, 64) || 'Eau',
        updatedAt: nextUpdatedAt,
        deletedAt: undefined,
      })
      return { applied: true, stale: false, updatedAt: nextUpdatedAt }
    }

    await ctx.db.insert('nutrition_water_entries', {
      userId,
      entryId: args.entryId,
      dateKey: normalizeDateKey(args.dateKey),
      amountMl: Math.max(0, Math.round(args.amountMl)),
      type: args.type.trim().slice(0, 32),
      label: args.label.trim().slice(0, 64) || 'Eau',
      createdAt: args.createdAt ?? nextUpdatedAt,
      updatedAt: nextUpdatedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, stale: false, updatedAt: nextUpdatedAt }
  },
})

export const deleteWaterEntry = mutation({
  args: {
    sessionToken: v.string(),
    entryId: v.string(),
    dateKey: v.string(),
    deletedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const deletedAt = args.deletedAt ?? Date.now()
    const existing = await findWaterRow(ctx, userId, args.entryId)
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > deletedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, {
        deletedAt,
        updatedAt: deletedAt,
      })
      return { applied: true, stale: false, updatedAt: deletedAt }
    }
    await ctx.db.insert('nutrition_water_entries', {
      userId,
      entryId: args.entryId,
      dateKey: normalizeDateKey(args.dateKey),
      amountMl: 0,
      type: 'deleted',
      label: 'deleted',
      createdAt: deletedAt,
      updatedAt: deletedAt,
      deletedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, stale: false, updatedAt: deletedAt }
  },
})

export const upsertDayState = mutation({
  args: {
    sessionToken: v.string(),
    dateKey: v.string(),
    waterBottleLevelMl: v.optional(v.union(v.number(), v.null())),
    waterBottleCalibrationTotalMl: v.optional(v.union(v.number(), v.null())),
    updatedAt: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.boolean(),
    stale: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const dateKey = normalizeDateKey(args.dateKey)
    const nextUpdatedAt = args.updatedAt ?? Date.now()
    const existing = await findDayStateRow(ctx, userId, dateKey)
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.updatedAt > nextUpdatedAt) {
        return { applied: false, stale: true, updatedAt: existing.updatedAt }
      }
      await ctx.db.patch(existing._id, {
        waterBottleLevelMl: args.waterBottleLevelMl,
        waterBottleCalibrationTotalMl: args.waterBottleCalibrationTotalMl,
        updatedAt: nextUpdatedAt,
      })
      return { applied: true, stale: false, updatedAt: nextUpdatedAt }
    }
    await ctx.db.insert('nutrition_day_state', {
      userId,
      dateKey,
      waterBottleLevelMl: args.waterBottleLevelMl,
      waterBottleCalibrationTotalMl: args.waterBottleCalibrationTotalMl,
      updatedAt: nextUpdatedAt,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, stale: false, updatedAt: nextUpdatedAt }
  },
})

export const listJournalEntries = query({
  args: {
    sessionToken: v.string(),
    startDateKey: v.optional(v.string()),
    endDateKey: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.object({
    meals: v.array(mealValidator),
    waterEntries: v.array(waterValidator),
    dayStates: v.array(dayStateValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const includeDeleted = Boolean(args.includeDeleted)
    const startDateKey = args.startDateKey ? normalizeDateKey(args.startDateKey) : undefined
    const endDateKey = args.endDateKey ? normalizeDateKey(args.endDateKey) : undefined

    const [mealRows, waterRows, dayRows] = await Promise.all([
      ctx.db
        .query('nutrition_meals')
        .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('nutrition_water_entries')
        .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('nutrition_day_state')
        .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
        .collect(),
    ])

    const meals = mealRows
      .filter((row) => withinDateRange(row.dateKey, startDateKey, endDateKey))
      .filter((row) => includeDeleted || !row.deletedAt)
      .map((row) => {
        assertUserOwnership(row.userId, userId)
        return {
          mealId: row.mealId,
          dateKey: row.dateKey,
          mealType: row.mealType,
          name: row.name,
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          grams: row.grams,
          pieces: row.pieces,
          portionMode: row.portionMode,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const waterEntries = waterRows
      .filter((row) => withinDateRange(row.dateKey, startDateKey, endDateKey))
      .filter((row) => includeDeleted || !row.deletedAt)
      .map((row) => {
        assertUserOwnership(row.userId, userId)
        return {
          entryId: row.entryId,
          dateKey: row.dateKey,
          amountMl: row.amountMl,
          type: row.type,
          label: row.label,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)

    const dayStates = dayRows
      .filter((row) => withinDateRange(row.dateKey, startDateKey, endDateKey))
      .map((row) => {
        assertUserOwnership(row.userId, userId)
        return {
          dateKey: row.dateKey,
          waterBottleLevelMl: row.waterBottleLevelMl ?? null,
          waterBottleCalibrationTotalMl: row.waterBottleCalibrationTotalMl ?? null,
          updatedAt: row.updatedAt,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return { meals, waterEntries, dayStates }
  },
})

export const upsertFoodSelection = mutation({
  args: {
    sessionToken: v.string(),
    barcode: v.optional(v.string()),
    name: v.string(),
    brand: v.optional(v.string()),
    caloriesPer100g: v.union(v.number(), v.null()),
    proteinPer100g: v.union(v.number(), v.null()),
    carbsPer100g: v.union(v.number(), v.null()),
    fatPer100g: v.union(v.number(), v.null()),
    imageUrl: v.optional(v.string()),
    source: v.union(
      v.literal('open_food_facts'),
      v.literal('manual'),
      v.literal('ai_photo'),
      v.literal('supabase_import'),
    ),
    fetchedAt: v.optional(v.number()),
    mealType: v.optional(v.string()),
    selectionEventId: v.string(),
  },
  returns: v.object({
    applied: v.boolean(),
    foodKey: v.string(),
    selectedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const now = Date.now()
    const foodKey = normalizeFoodKey({
      barcode: args.barcode,
      name: args.name,
      brand: args.brand,
    })
    const existing = await findFoodRow(ctx, userId, foodKey)
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      if (existing.lastSelectionEventId === args.selectionEventId) {
        return {
          applied: false,
          foodKey,
          selectedCount: existing.selectedCount,
        }
      }
      const selectedCount = (existing.selectedCount ?? 0) + 1
      await ctx.db.patch(existing._id, {
        barcode: args.barcode?.trim() || undefined,
        name: mealName(args.name),
        brand: args.brand?.trim() || undefined,
        caloriesPer100g: args.caloriesPer100g,
        proteinPer100g: args.proteinPer100g,
        carbsPer100g: args.carbsPer100g,
        fatPer100g: args.fatPer100g,
        imageUrl: args.imageUrl,
        source: args.source,
        lastFetchedAt: args.fetchedAt ?? now,
        lastSelectedAt: now,
        lastUsedMealType: args.mealType?.trim() || existing.lastUsedMealType,
        selectedCount,
        updatedAt: now,
        lastSelectionEventId: args.selectionEventId,
      })
      return { applied: true, foodKey, selectedCount }
    }

    await ctx.db.insert('nutrition_food_catalog', {
      userId,
      foodKey,
      barcode: args.barcode?.trim() || undefined,
      name: mealName(args.name),
      brand: args.brand?.trim() || undefined,
      caloriesPer100g: args.caloriesPer100g,
      proteinPer100g: args.proteinPer100g,
      carbsPer100g: args.carbsPer100g,
      fatPer100g: args.fatPer100g,
      imageUrl: args.imageUrl,
      source: args.source,
      lastFetchedAt: args.fetchedAt ?? now,
      lastSelectedAt: now,
      selectedCount: 1,
      isFavorite: false,
      lastUsedMealType: args.mealType?.trim() || undefined,
      updatedAt: now,
      lastSelectionEventId: args.selectionEventId,
      schemaVersion: NUTRITION_SCHEMA_VERSION,
    })
    return { applied: true, foodKey, selectedCount: 1 }
  },
})

export const setFoodFavorite = mutation({
  args: {
    sessionToken: v.string(),
    foodKey: v.string(),
    isFavorite: v.boolean(),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const existing = await findFoodRow(ctx, userId, args.foodKey)
    if (!existing) return { applied: false }
    assertUserOwnership(existing.userId, userId)
    await ctx.db.patch(existing._id, {
      isFavorite: args.isFavorite,
      updatedAt: Date.now(),
    })
    return { applied: true }
  },
})

export const listFoodCatalog = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
    favoritesOnly: v.optional(v.boolean()),
  },
  returns: v.array(foodValidator),
  handler: async (ctx, args) => {
    const userId = await sessionUserId(ctx, args.sessionToken)
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 40)))
    const rows = args.favoritesOnly
      ? await ctx.db
          .query('nutrition_food_catalog')
          .withIndex('by_userId_favorite', (q) => q.eq('userId', userId).eq('isFavorite', true))
          .collect()
      : await ctx.db
          .query('nutrition_food_catalog')
          .withIndex('by_userId_lastSelectedAt', (q) => q.eq('userId', userId))
          .collect()
    return rows
      .map((row) => {
        assertUserOwnership(row.userId, userId)
        return {
          foodKey: row.foodKey,
          barcode: row.barcode,
          name: row.name,
          brand: row.brand,
          caloriesPer100g: row.caloriesPer100g,
          proteinPer100g: row.proteinPer100g,
          carbsPer100g: row.carbsPer100g,
          fatPer100g: row.fatPer100g,
          imageUrl: row.imageUrl,
          source: row.source,
          lastFetchedAt: row.lastFetchedAt,
          lastSelectedAt: row.lastSelectedAt,
          selectedCount: row.selectedCount,
          isFavorite: row.isFavorite,
          lastUsedMealType: row.lastUsedMealType,
          updatedAt: row.updatedAt,
        }
      })
      .sort((a, b) => b.lastSelectedAt - a.lastSelectedAt)
      .slice(0, limit)
  },
})

export const fetchOpenFoodFactsByBarcode = action({
  args: {
    sessionToken: v.string(),
    barcode: v.string(),
  },
  returns: v.object({
    barcode: v.string(),
    nom: v.string(),
    brands: v.string(),
    calories: v.union(v.number(), v.null()),
    proteines: v.union(v.number(), v.null()),
    glucides: v.union(v.number(), v.null()),
    lipides: v.union(v.number(), v.null()),
    imageUrl: v.optional(v.string()),
    provenance: v.literal('open_food_facts'),
    fetchedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await assertActionSession(ctx, args.sessionToken)
    const code = args.barcode.trim()
    if (!code) throw new Error('OFF_BARCODE_REQUIRED')
    const data = (await fetchOffJson(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    )) as { status?: number; product?: OffApiProduct }
    if (data.status !== 1 || !data.product) {
      throw new Error('OFF_PRODUCT_NOT_FOUND')
    }
    return mapOffProduct(data.product, code)
  },
})

export const searchOpenFoodFacts = action({
  args: {
    sessionToken: v.string(),
    term: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      barcode: v.string(),
      nom: v.string(),
      brands: v.string(),
      calories: v.union(v.number(), v.null()),
      proteines: v.union(v.number(), v.null()),
      glucides: v.union(v.number(), v.null()),
      lipides: v.union(v.number(), v.null()),
      imageUrl: v.optional(v.string()),
      provenance: v.literal('open_food_facts'),
      fetchedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await assertActionSession(ctx, args.sessionToken)
    const term = args.term.trim()
    if (term.length < 2) return []
    const limit = Math.max(1, Math.min(OFF_MAX_RESULTS, Math.floor(args.limit ?? OFF_MAX_RESULTS)))
    const data = (await fetchOffJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&sort_by=unique_scans_n&page_size=${limit}`,
    )) as { products?: OffApiProduct[] }
    const products = Array.isArray(data.products) ? data.products : []
    const hits: Array<ReturnType<typeof mapOffProduct>> = []
    for (const product of products) {
      const mapped = mapOffProduct(product, String(product.code || product._id || ''))
      if (!mapped.nom.trim()) continue
      hits.push(mapped)
      if (hits.length >= limit) break
    }
    return hits
  },
})
