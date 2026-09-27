import { v } from 'convex/values'
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server'
import {
  assertRunSecretStrength,
  hashMigrationSecret,
  requireAdminCaller,
  requireAuthorizedMigrationRun,
  type AdminAuthz,
} from './lib/migrationAdmin'

export const MIGRATION_ENTITY_TYPES = [
  'auth_users',
  'profiles',
  'workouts',
  'nutrition',
  'checkins',
  'aliments',
  'activities',
  'ai_usage_limits',
  'user_backups',
] as const

export type MigrationEntityType = (typeof MIGRATION_ENTITY_TYPES)[number]
type MigrationEntityCounts = Record<MigrationEntityType, number>
type DerivedPerUserCounts = {
  streak_state: Record<string, number>
  custom_spots: Record<string, number>
  active_checkins: Record<string, number>
  nutrition_meals: Record<string, number>
  nutrition_water_entries: Record<string, number>
  nutrition_day_state: Record<string, number>
  nutrition_food_catalog: Record<string, number>
}

type ImportOperation = 'inserted' | 'updated' | 'skipped'

function entityTypeValidator() {
  return v.union(
    ...MIGRATION_ENTITY_TYPES.map((name) => v.literal(name as MigrationEntityType)),
  )
}

async function findRun(ctx: QueryCtx | MutationCtx, runId: string) {
  return ctx.db.query('migration_runs').withIndex('by_runId', (q) => q.eq('runId', runId)).first()
}

async function findMap(ctx: QueryCtx | MutationCtx, entityType: string, supabaseId: string) {
  return ctx.db
    .query('migration_entity_map')
    .withIndex('by_entity_supabaseId', (q) => q.eq('entityType', entityType).eq('supabaseId', supabaseId))
    .first()
}

const adminAuthArgs = {
  adminSecret: v.optional(v.string()),
  sessionToken: v.optional(v.string()),
}

function toAdminAuthz(args: AdminAuthz): AdminAuthz {
  return {
    adminSecret: args.adminSecret,
    sessionToken: args.sessionToken,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableFiniteNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeFoodCatalogKey(input: { barcode?: string; name: string; brand?: string }): string {
  const barcode = input.barcode?.trim()
  if (barcode) return `barcode:${barcode}`
  const name = input.name.trim().toLowerCase().slice(0, 140)
  const brand = input.brand?.trim().toLowerCase().slice(0, 80) ?? ''
  return `name:${name}|brand:${brand}`
}

async function upsertAuthUser(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_AUTH_USER_ID')
  const now = Date.now()
  const existing = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const incomingMustReset =
    typeof payload.mustResetPassword === 'boolean' ? payload.mustResetPassword : true
  const mustResetPassword = existing
    ? existing.mustResetPassword
      ? incomingMustReset
      : false
    : incomingMustReset
  const patch = {
    email: String(payload.email ?? ''),
    emailNorm: String(payload.emailNorm ?? String(payload.email ?? '').trim().toLowerCase()),
    displayName: String(payload.displayName ?? 'Athlete'),
    mustResetPassword,
    updatedAt: Number(payload.updatedAt ?? now),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('auth_users', {
    userId,
    createdAt: Number(payload.createdAt ?? now),
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertProfile(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_PROFILE_USER_ID')
  const now = Date.now()
  const updatedAt = toFiniteNumber(payload.updatedAt, now)
  const patch = {
    pseudo: String(payload.pseudo ?? 'Athlete').slice(0, 24),
    level: Math.max(1, Number(payload.level ?? 1)),
    xp: Math.max(0, Number(payload.xp ?? 0)),
    rank: String(payload.rank ?? 'Bronze'),
    discipline: String(payload.discipline ?? 'Musculation'),
    isGhostModeEnabled: Boolean(payload.isGhostModeEnabled),
    isPrivate: Boolean(payload.isPrivate),
    updatedAt,
  }
  const existing = await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).first()
  let operation: 'inserted' | 'updated'
  let convexId: string
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    operation = 'updated'
    convexId = String(existing._id)
  } else {
    const inserted = await ctx.db.insert('profiles', {
      userId,
      createdAt: Number(payload.createdAt ?? now),
      ...patch,
    })
    operation = 'inserted'
    convexId = String(inserted)
  }

  const streak = await ctx.db.query('streak_state').withIndex('by_userId', (q) => q.eq('userId', userId)).first()
  const streakPatch = {
    currentStreak: Math.max(0, Math.round(toFiniteNumber(payload.currentStreak, 0))),
    lastLoginDate:
      payload.lastLoginDate == null
        ? null
        : String(payload.lastLoginDate).trim() || null,
    updatedAt,
  }
  if (streak) {
    await ctx.db.patch(streak._id, streakPatch)
  } else {
    await ctx.db.insert('streak_state', {
      userId,
      ...streakPatch,
    })
  }

  const incomingSpots = Array.isArray(payload.customSpotsJson) ? payload.customSpotsJson : []
  const existingSpots = await ctx.db
    .query('custom_spots')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const existingBySpotId = new Map(existingSpots.map((row) => [row.spotId, row] as const))
  const incomingIds = new Set<string>()
  for (let index = 0; index < incomingSpots.length; index += 1) {
    const spot = asRecord(incomingSpots[index]) ?? {}
    const spotId = String(spot.id ?? spot.spotId ?? `spot-${index}`).trim()
    if (!spotId || incomingIds.has(spotId)) continue
    incomingIds.add(spotId)
    const fields = {
      name: String(spot.name ?? 'Spot').slice(0, 120),
      lat: toFiniteNumber(spot.lat, 0),
      lng: toFiniteNumber(spot.lng, 0),
      address:
        typeof spot.address === 'string' && spot.address.trim()
          ? spot.address.trim().slice(0, 240)
          : undefined,
      metadata: spot,
      updatedAt,
    }
    const existingSpot = existingBySpotId.get(spotId)
    if (existingSpot) {
      await ctx.db.patch(existingSpot._id, fields)
    } else {
      await ctx.db.insert('custom_spots', {
        userId,
        spotId,
        createdAt: Number(payload.createdAt ?? updatedAt),
        ...fields,
      })
    }
  }
  for (const row of existingSpots) {
    if (incomingIds.has(row.spotId)) continue
    await ctx.db.delete(row._id)
  }

  const existingActive = await ctx.db
    .query('active_checkins')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  if (payload.activeCheckinJson == null) {
    if (existingActive) await ctx.db.delete(existingActive._id)
  } else if (existingActive) {
    await ctx.db.patch(existingActive._id, {
      checkinJson: payload.activeCheckinJson,
      updatedAt,
    })
  } else {
    await ctx.db.insert('active_checkins', {
      userId,
      checkinJson: payload.activeCheckinJson,
      updatedAt,
    })
  }

  return { convexId, operation }
}

async function upsertWorkouts(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_WORKOUTS_USER_ID')
  const existing = await ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    stateJson: payload.stateJson ?? {},
    progressJson: payload.progressJson ?? {},
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('workouts_state', {
    userId,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertNutrition(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_NUTRITION_USER_ID')
  const now = Date.now()
  const updatedAt = toFiniteNumber(payload.updatedAt, now)
  const existing = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    profileJson: payload.profileJson ?? {},
    journalJson: payload.journalJson ?? {},
    updatedAt,
  }
  let operation: 'inserted' | 'updated'
  let convexId: string
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    operation = 'updated'
    convexId = String(existing._id)
  } else {
    const inserted = await ctx.db.insert('nutrition_state', {
      userId,
      ...patch,
    })
    operation = 'inserted'
    convexId = String(inserted)
  }

  const incomingMeals = (Array.isArray(payload.normalizedMeals) ? payload.normalizedMeals : [])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
  const existingMeals = await ctx.db
    .query('nutrition_meals')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const existingMealsById = new Map(existingMeals.map((row) => [row.mealId, row] as const))
  const incomingMealIds = new Set<string>()
  for (const meal of incomingMeals) {
    const mealId = String(meal.mealId ?? '').trim()
    if (!mealId || incomingMealIds.has(mealId)) continue
    incomingMealIds.add(mealId)
    const portionMode: 'solo' | 'with_sides' | undefined =
      meal.portionMode === 'solo' || meal.portionMode === 'with_sides'
        ? (meal.portionMode as 'solo' | 'with_sides')
        : undefined
    const fields = {
      dateKey: String(meal.dateKey ?? '').trim(),
      mealType: String(meal.mealType ?? 'snack').trim().slice(0, 24) || 'snack',
      name: String(meal.name ?? 'Repas').trim().slice(0, 120) || 'Repas',
      calories: toNullableFiniteNumber(meal.calories),
      proteinG: meal.proteinG == null ? undefined : toNullableFiniteNumber(meal.proteinG),
      carbsG: meal.carbsG == null ? undefined : toNullableFiniteNumber(meal.carbsG),
      fatG: meal.fatG == null ? undefined : toNullableFiniteNumber(meal.fatG),
      grams: meal.grams == null ? undefined : toFiniteNumber(meal.grams, 0),
      pieces: meal.pieces == null ? undefined : toFiniteNumber(meal.pieces, 0),
      portionMode,
      createdAt: toFiniteNumber(meal.createdAt, updatedAt),
      updatedAt: toFiniteNumber(meal.updatedAt, updatedAt),
      deletedAt: meal.deletedAt == null ? undefined : toFiniteNumber(meal.deletedAt, updatedAt),
      schemaVersion: Math.max(1, Math.round(toFiniteNumber(meal.schemaVersion, 1))),
    }
    const existingMeal = existingMealsById.get(mealId)
    if (existingMeal) {
      await ctx.db.patch(existingMeal._id, fields)
    } else {
      await ctx.db.insert('nutrition_meals', {
        userId,
        mealId,
        ...fields,
      })
    }
  }
  for (const row of existingMeals) {
    if (incomingMealIds.has(row.mealId)) continue
    await ctx.db.delete(row._id)
  }

  const incomingWaterEntries = (Array.isArray(payload.normalizedWaterEntries)
    ? payload.normalizedWaterEntries
    : [])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
  const existingWaterEntries = await ctx.db
    .query('nutrition_water_entries')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const existingWaterById = new Map(existingWaterEntries.map((row) => [row.entryId, row] as const))
  const incomingWaterIds = new Set<string>()
  for (const entry of incomingWaterEntries) {
    const entryId = String(entry.entryId ?? '').trim()
    if (!entryId || incomingWaterIds.has(entryId)) continue
    incomingWaterIds.add(entryId)
    const fields = {
      dateKey: String(entry.dateKey ?? '').trim(),
      amountMl: Math.max(0, Math.round(toFiniteNumber(entry.amountMl, 0))),
      type: String(entry.type ?? 'manual').trim().slice(0, 32) || 'manual',
      label: String(entry.label ?? 'Eau').trim().slice(0, 64) || 'Eau',
      createdAt: toFiniteNumber(entry.createdAt, updatedAt),
      updatedAt: toFiniteNumber(entry.updatedAt, updatedAt),
      deletedAt: entry.deletedAt == null ? undefined : toFiniteNumber(entry.deletedAt, updatedAt),
      schemaVersion: Math.max(1, Math.round(toFiniteNumber(entry.schemaVersion, 1))),
    }
    const existingEntry = existingWaterById.get(entryId)
    if (existingEntry) {
      await ctx.db.patch(existingEntry._id, fields)
    } else {
      await ctx.db.insert('nutrition_water_entries', {
        userId,
        entryId,
        ...fields,
      })
    }
  }
  for (const row of existingWaterEntries) {
    if (incomingWaterIds.has(row.entryId)) continue
    await ctx.db.delete(row._id)
  }

  const incomingDayStates = (Array.isArray(payload.normalizedDayStates) ? payload.normalizedDayStates : [])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
  const existingDays = await ctx.db
    .query('nutrition_day_state')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const existingDayByDateKey = new Map(existingDays.map((row) => [row.dateKey, row] as const))
  const incomingDayKeys = new Set<string>()
  for (const dayState of incomingDayStates) {
    const dateKey = String(dayState.dateKey ?? '').trim()
    if (!dateKey || incomingDayKeys.has(dateKey)) continue
    incomingDayKeys.add(dateKey)
    const fields = {
      waterBottleLevelMl:
        dayState.waterBottleLevelMl == null
          ? undefined
          : toNullableFiniteNumber(dayState.waterBottleLevelMl),
      waterBottleCalibrationTotalMl:
        dayState.waterBottleCalibrationTotalMl == null
          ? undefined
          : toNullableFiniteNumber(dayState.waterBottleCalibrationTotalMl),
      updatedAt: toFiniteNumber(dayState.updatedAt, updatedAt),
      schemaVersion: Math.max(1, Math.round(toFiniteNumber(dayState.schemaVersion, 1))),
    }
    const existingDay = existingDayByDateKey.get(dateKey)
    if (existingDay) {
      await ctx.db.patch(existingDay._id, fields)
    } else {
      await ctx.db.insert('nutrition_day_state', {
        userId,
        dateKey,
        ...fields,
      })
    }
  }
  for (const row of existingDays) {
    if (incomingDayKeys.has(row.dateKey)) continue
    await ctx.db.delete(row._id)
  }

  return { convexId, operation }
}

async function upsertMapBoundDoc(
  ctx: MutationCtx,
  table: 'checkins' | 'aliments' | 'activities',
  mapConvexId: string | null,
  insertDoc: Record<string, unknown>,
  patchDoc: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  if (mapConvexId) {
    const existing = await ctx.db.get(mapConvexId as never)
    if (existing) {
      await ctx.db.patch(existing._id, patchDoc as never)
      return { convexId: String(existing._id), operation: 'updated' }
    }
  }
  const inserted = await ctx.db.insert(table, insertDoc as never)
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertCheckin(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_CHECKIN_USER_ID')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    salleNom: String(payload.salleNom ?? 'Salle'),
    salleLat: payload.salleLat == null ? null : Number(payload.salleLat),
    salleLng: payload.salleLng == null ? null : Number(payload.salleLng),
    gymPayload: payload.gymPayload ?? null,
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  return upsertMapBoundDoc(ctx, 'checkins', mapConvexId, patchDoc, patchDoc)
}

async function upsertAliment(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_ALIMENT_USER_ID')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    nom: String(payload.nom ?? 'Aliment'),
    calories: Number(payload.calories ?? 0),
    proteines: Number(payload.proteines ?? 0),
    glucides: Number(payload.glucides ?? 0),
    lipides: Number(payload.lipides ?? 0),
    barcode: payload.barcode == null ? undefined : String(payload.barcode),
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  const result = await upsertMapBoundDoc(ctx, 'aliments', mapConvexId, patchDoc, patchDoc)

  const catalogInput = asRecord(payload.catalogRow) ?? {}
  const name = String(catalogInput.name ?? patchDoc.nom).trim().slice(0, 120) || 'Aliment'
  const barcode =
    typeof catalogInput.barcode === 'string' && catalogInput.barcode.trim()
      ? catalogInput.barcode.trim()
      : patchDoc.barcode
  const brand =
    typeof catalogInput.brand === 'string' && catalogInput.brand.trim()
      ? catalogInput.brand.trim().slice(0, 80)
      : undefined
  const foodKey = normalizeFoodCatalogKey({ barcode, name, brand })
  const existingCatalog = await ctx.db
    .query('nutrition_food_catalog')
    .withIndex('by_userId_foodKey', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
    .first()
  const catalogPatch = {
    barcode,
    name,
    brand,
    caloriesPer100g:
      catalogInput.caloriesPer100g == null
        ? toNullableFiniteNumber(payload.calories)
        : toNullableFiniteNumber(catalogInput.caloriesPer100g),
    proteinPer100g:
      catalogInput.proteinPer100g == null
        ? toNullableFiniteNumber(payload.proteines)
        : toNullableFiniteNumber(catalogInput.proteinPer100g),
    carbsPer100g:
      catalogInput.carbsPer100g == null
        ? toNullableFiniteNumber(payload.glucides)
        : toNullableFiniteNumber(catalogInput.carbsPer100g),
    fatPer100g:
      catalogInput.fatPer100g == null
        ? toNullableFiniteNumber(payload.lipides)
        : toNullableFiniteNumber(catalogInput.fatPer100g),
    imageUrl:
      typeof catalogInput.imageUrl === 'string' && catalogInput.imageUrl.trim()
        ? catalogInput.imageUrl.trim()
        : undefined,
    source: 'supabase_import' as const,
    lastFetchedAt: toFiniteNumber(catalogInput.lastFetchedAt, patchDoc.createdAt),
    lastSelectedAt: toFiniteNumber(catalogInput.lastSelectedAt, patchDoc.createdAt),
    selectedCount: Math.max(1, Math.round(toFiniteNumber(catalogInput.selectedCount, 1))),
    isFavorite: Boolean(catalogInput.isFavorite),
    lastUsedMealType:
      typeof catalogInput.lastUsedMealType === 'string' && catalogInput.lastUsedMealType.trim()
        ? catalogInput.lastUsedMealType.trim().slice(0, 24)
        : undefined,
    updatedAt: toFiniteNumber(catalogInput.updatedAt, patchDoc.createdAt),
    schemaVersion: Math.max(1, Math.round(toFiniteNumber(catalogInput.schemaVersion, 1))),
  }
  if (existingCatalog) {
    await ctx.db.patch(existingCatalog._id, catalogPatch)
  } else {
    await ctx.db.insert('nutrition_food_catalog', {
      userId,
      foodKey,
      ...catalogPatch,
    })
  }

  return result
}

async function upsertActivity(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_ACTIVITY_USER_ID')
  const activityType = String(payload.activityType ?? 'workout')
  if (!ACTIVITY_TYPES.includes(activityType)) throw new Error('MIGRATION_INVALID_ACTIVITY_TYPE')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    activityType,
    actionText: String(payload.actionText ?? '').slice(0, 280) || 'Activite importee',
    xpEarned: Math.max(0, Math.min(10_000, Number(payload.xpEarned ?? 0))),
    originLat: payload.originLat == null ? null : Number(payload.originLat),
    originLng: payload.originLng == null ? null : Number(payload.originLng),
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  return upsertMapBoundDoc(ctx, 'activities', mapConvexId, patchDoc, patchDoc)
}

const ACTIVITY_TYPES = ['pr', 'workout', 'checkin', 'rank_up', 'streak']

async function upsertAiUsageLimit(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  const dateOfScan = String(payload.dateOfScan ?? '')
  if (!userId || !dateOfScan) throw new Error('MIGRATION_INVALID_AI_USAGE_KEY')
  const existing = await ctx.db
    .query('ai_usage_limits')
    .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', userId).eq('dateOfScan', dateOfScan))
    .first()
  const patch = {
    scanCount: Math.max(0, Number(payload.scanCount ?? 0)),
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('ai_usage_limits', {
    userId,
    dateOfScan,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertBackup(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_BACKUP_USER_ID')
  const existing = await ctx.db
    .query('legacy_supabase_backups')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    payloadJson: payload.payloadJson ?? {},
    updatedAt: Number(payload.updatedAt ?? Date.now()),
    source: 'supabase_user_backups' as const,
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('legacy_supabase_backups', {
    userId,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertEntity(
  ctx: MutationCtx,
  args: {
    entityType: MigrationEntityType
    supabaseId: string
    payload: Record<string, unknown>
    mapConvexId: string | null
  },
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  switch (args.entityType) {
    case 'auth_users':
      return upsertAuthUser(ctx, args.payload)
    case 'profiles':
      return upsertProfile(ctx, args.payload)
    case 'workouts':
      return upsertWorkouts(ctx, args.payload)
    case 'nutrition':
      return upsertNutrition(ctx, args.payload)
    case 'checkins':
      return upsertCheckin(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'aliments':
      return upsertAliment(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'activities':
      return upsertActivity(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'ai_usage_limits':
      return upsertAiUsageLimit(ctx, args.payload)
    case 'user_backups':
      return upsertBackup(ctx, args.payload)
    default:
      throw new Error('MIGRATION_ENTITY_UNSUPPORTED')
  }
}

export async function startRunForAdmin(
  ctx: MutationCtx,
  args: {
    runId: string
    sourceSha: string
    runSecret: string
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ created: boolean }> {
  await requireAdminCaller(ctx, toAdminAuthz(args))
  assertRunSecretStrength(args.runSecret)
  const now = Date.now()
  const adminSecretHash = await hashMigrationSecret(args.runSecret)
  const existing = await findRun(ctx, args.runId)
  if (existing) {
    await requireAuthorizedMigrationRun(ctx, {
      runId: args.runId,
      runSecret: args.runSecret,
    })
    await ctx.db.patch(existing._id, {
      status: 'running',
      sourceSha: args.sourceSha || existing.sourceSha,
      summaryJson: { ...(existing.summaryJson ?? {}), resumedAt: now },
    })
    return { created: false }
  }
  await ctx.db.insert('migration_runs', {
    runId: args.runId,
    startedAt: now,
    status: 'running',
    sourceSha: args.sourceSha,
    adminSecretHash,
    summaryJson: {},
  })
  return { created: true }
}

export async function importEntityForRun(
  ctx: MutationCtx,
  args: {
    runId: string
    sourceSha: string
    runSecret: string
    entityType: MigrationEntityType
    supabaseId: string
    checksum: string
    payload: Record<string, unknown>
    dryRun?: boolean
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ operation: ImportOperation; convexId: string | null }> {
  await requireAdminCaller(ctx, toAdminAuthz(args))
  await requireAuthorizedMigrationRun(ctx, {
    runId: args.runId,
    runSecret: args.runSecret,
    sourceSha: args.sourceSha,
  })
  const now = Date.now()
  const existingMap = await findMap(ctx, args.entityType, args.supabaseId)
  if (existingMap && existingMap.checksum === args.checksum) {
    await ctx.db.patch(existingMap._id, { importedAt: now })
    return { operation: 'skipped', convexId: existingMap.convexId }
  }

  if (args.dryRun) {
    return { operation: existingMap ? 'updated' : 'inserted', convexId: existingMap?.convexId ?? null }
  }

  const outcome = await upsertEntity(ctx, {
    entityType: args.entityType,
    supabaseId: args.supabaseId,
    payload: args.payload,
    mapConvexId: existingMap?.convexId ?? null,
  })

  if (existingMap) {
    await ctx.db.patch(existingMap._id, {
      runId: args.runId,
      convexId: outcome.convexId,
      checksum: args.checksum,
      importedAt: now,
    })
  } else {
    await ctx.db.insert('migration_entity_map', {
      runId: args.runId,
      entityType: args.entityType,
      supabaseId: args.supabaseId,
      convexId: outcome.convexId,
      checksum: args.checksum,
      importedAt: now,
    })
  }

  return { operation: outcome.operation, convexId: outcome.convexId }
}

export async function finishRunForAdmin(
  ctx: MutationCtx,
  args: {
    runId: string
    runSecret: string
    status: 'running' | 'completed' | 'failed' | 'aborted'
    summaryJson: unknown
    adminSecret?: string
    sessionToken?: string
  },
): Promise<null> {
  await requireAdminCaller(ctx, toAdminAuthz(args))
  const run = await requireAuthorizedMigrationRun(ctx, {
    runId: args.runId,
    runSecret: args.runSecret,
  })
  await ctx.db.patch(run._id, {
    status: args.status,
    finishedAt: Date.now(),
    summaryJson: args.summaryJson ?? {},
  })
  return null
}

export const startRun = internalMutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
    runSecret: v.string(),
    ...adminAuthArgs,
  },
  returns: v.object({
    created: v.boolean(),
  }),
  handler: (ctx, args) => startRunForAdmin(ctx, args),
})

export const importEntity = internalMutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
    runSecret: v.string(),
    entityType: entityTypeValidator(),
    supabaseId: v.string(),
    checksum: v.string(),
    payload: v.any(),
    dryRun: v.optional(v.boolean()),
    ...adminAuthArgs,
  },
  returns: v.object({
    operation: v.union(v.literal('inserted'), v.literal('updated'), v.literal('skipped')),
    convexId: v.union(v.string(), v.null()),
  }),
  handler: (ctx, args) =>
    importEntityForRun(ctx, {
      runId: args.runId,
      sourceSha: args.sourceSha,
      runSecret: args.runSecret,
      entityType: args.entityType,
      supabaseId: args.supabaseId,
      checksum: args.checksum,
      payload: (args.payload ?? {}) as Record<string, unknown>,
      dryRun: args.dryRun,
      adminSecret: args.adminSecret,
      sessionToken: args.sessionToken,
    }),
})

export const finishRun = internalMutation({
  args: {
    runId: v.string(),
    runSecret: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('aborted'),
    ),
    summaryJson: v.any(),
    ...adminAuthArgs,
  },
  returns: v.null(),
  handler: (ctx, args) => finishRunForAdmin(ctx, args),
})

function createEmptyEntityCounts(): MigrationEntityCounts {
  return {
    auth_users: 0,
    profiles: 0,
    workouts: 0,
    nutrition: 0,
    checkins: 0,
    aliments: 0,
    activities: 0,
    ai_usage_limits: 0,
    user_backups: 0,
  }
}

function toEntityCounts(rows: Array<{ entityType: string }>): MigrationEntityCounts {
  const counts = createEmptyEntityCounts()
  for (const row of rows) {
    if (row.entityType in counts) {
      counts[row.entityType as MigrationEntityType] += 1
    }
  }
  return counts
}

function createEmptyDerivedPerUserCounts(): DerivedPerUserCounts {
  return {
    streak_state: {},
    custom_spots: {},
    active_checkins: {},
    nutrition_meals: {},
    nutrition_water_entries: {},
    nutrition_day_state: {},
    nutrition_food_catalog: {},
  }
}

function incrementPerUserCount(table: Record<string, number>, userId: string) {
  table[userId] = (table[userId] ?? 0) + 1
}

export async function getCountsForAdmin(
  ctx: QueryCtx,
  args: {
    runId?: string
    runSecret?: string
    adminSecret?: string
    sessionToken?: string
  },
) {
  await requireAdminCaller(ctx, toAdminAuthz(args))
  if (args.runId) {
    await requireAuthorizedMigrationRun(ctx, {
      runId: args.runId,
      runSecret: args.runSecret ?? '',
    })
  }
  const mapRows = await ctx.db.query('migration_entity_map').collect()
  const scoped = args.runId ? mapRows.filter((row) => row.runId === args.runId) : mapRows
  const mappedEntities = toEntityCounts(scoped)
  const [streakRows, customSpotRows, activeCheckinRows, mealRows, waterRows, dayRows, foodRows] =
    await Promise.all([
      ctx.db.query('streak_state').collect(),
      ctx.db.query('custom_spots').collect(),
      ctx.db.query('active_checkins').collect(),
      ctx.db.query('nutrition_meals').collect(),
      ctx.db.query('nutrition_water_entries').collect(),
      ctx.db.query('nutrition_day_state').collect(),
      ctx.db.query('nutrition_food_catalog').collect(),
    ])
  const perUserDerivedTables = createEmptyDerivedPerUserCounts()
  for (const row of streakRows) incrementPerUserCount(perUserDerivedTables.streak_state, row.userId)
  for (const row of customSpotRows) incrementPerUserCount(perUserDerivedTables.custom_spots, row.userId)
  for (const row of activeCheckinRows) incrementPerUserCount(perUserDerivedTables.active_checkins, row.userId)
  for (const row of mealRows) incrementPerUserCount(perUserDerivedTables.nutrition_meals, row.userId)
  for (const row of waterRows)
    incrementPerUserCount(perUserDerivedTables.nutrition_water_entries, row.userId)
  for (const row of dayRows) incrementPerUserCount(perUserDerivedTables.nutrition_day_state, row.userId)
  for (const row of foodRows)
    incrementPerUserCount(perUserDerivedTables.nutrition_food_catalog, row.userId)
  return {
    tables: {
      auth_users: (await ctx.db.query('auth_users').collect()).length,
      profiles: (await ctx.db.query('profiles').collect()).length,
      workouts: (await ctx.db.query('workouts_state').collect()).length,
      nutrition: (await ctx.db.query('nutrition_state').collect()).length,
      checkins: (await ctx.db.query('checkins').collect()).length,
      aliments: (await ctx.db.query('aliments').collect()).length,
      activities: (await ctx.db.query('activities').collect()).length,
      ai_usage_limits: (await ctx.db.query('ai_usage_limits').collect()).length,
      user_backups: (await ctx.db.query('legacy_supabase_backups').collect()).length,
      streak_state: streakRows.length,
      custom_spots: customSpotRows.length,
      active_checkins: activeCheckinRows.length,
      nutrition_meals: mealRows.length,
      nutrition_water_entries: waterRows.length,
      nutrition_day_state: dayRows.length,
      nutrition_food_catalog: foodRows.length,
    },
    mappedEntities,
    perUserDerivedTables,
  }
}

export const getCounts = internalQuery({
  args: {
    runId: v.optional(v.string()),
    runSecret: v.optional(v.string()),
    ...adminAuthArgs,
  },
  returns: v.object({
    tables: v.object({
      auth_users: v.number(),
      profiles: v.number(),
      workouts: v.number(),
      nutrition: v.number(),
      checkins: v.number(),
      aliments: v.number(),
      activities: v.number(),
      ai_usage_limits: v.number(),
      user_backups: v.number(),
      streak_state: v.number(),
      custom_spots: v.number(),
      active_checkins: v.number(),
      nutrition_meals: v.number(),
      nutrition_water_entries: v.number(),
      nutrition_day_state: v.number(),
      nutrition_food_catalog: v.number(),
    }),
    mappedEntities: v.object({
      auth_users: v.number(),
      profiles: v.number(),
      workouts: v.number(),
      nutrition: v.number(),
      checkins: v.number(),
      aliments: v.number(),
      activities: v.number(),
      ai_usage_limits: v.number(),
      user_backups: v.number(),
    }),
    perUserDerivedTables: v.object({
      streak_state: v.record(v.string(), v.number()),
      custom_spots: v.record(v.string(), v.number()),
      active_checkins: v.record(v.string(), v.number()),
      nutrition_meals: v.record(v.string(), v.number()),
      nutrition_water_entries: v.record(v.string(), v.number()),
      nutrition_day_state: v.record(v.string(), v.number()),
      nutrition_food_catalog: v.record(v.string(), v.number()),
    }),
  }),
  handler: (ctx, args) => getCountsForAdmin(ctx, args),
})
