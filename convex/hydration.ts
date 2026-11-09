/**
 * Hydratation v0 — Convex API (ARCHI_HYDRATATION §3–4).
 * Isolation RK-03 : n’importe rien de ranked* / rewards*.
 */
import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireSessionUser } from './lib/auth'
import { hasActivePro } from './lib/proEntitlement'
import {
  extractStoredNutritionAge,
  NUTRITION_ADULT_MIN,
} from './lib/nutritionProfile'
import {
  CLASSIC_BOTTLE_ML,
  CONTAINER_MAX_ML,
  CONTAINER_MIN_ML,
  DEFAULT_REMINDER_TIMES,
  ENTRY_MAX_ML,
  ENTRY_MIN_ML,
  GLASS_ML,
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  HYDRATION_ENTRY_SOURCES,
  HYDRATION_MODES,
  REMINDERS_MAX_PER_DAY,
  type HydrationEntrySource,
  type HydrationMode,
  clampGoalMl,
  isDayKeyWithinTolerance,
  isReminderTimeAllowed,
  isValidDayKey,
  lastNDayKeys,
  legacyWaterEntryClientId,
  effectiveHydrationGoalMl,
  isDayKeyWithinLegacyMigrationWindow,
  isLegacyHydrationClientId,
  remainingMl,
  showHighInfo,
} from './lib/hydrationConstants'

type SessionCtx = QueryCtx | MutationCtx

const modeValidator = v.union(
  v.literal('classic_2l'),
  v.literal('glasses_250'),
  v.literal('my_bottle'),
)

const sourceValidator = v.union(
  v.literal('glass'),
  v.literal('half_bottle'),
  v.literal('full_bottle'),
  v.literal('slider'),
)

function defaultSettings(userId: string, now: number): Omit<Doc<'hydrationSettings'>, '_id' | '_creationTime'> {
  return {
    userId,
    mode: 'classic_2l',
    goalMl: GOAL_DEFAULT_ML,
    myBottleHasShape: false,
    remindersEnabled: false,
    reminderTimes: [...DEFAULT_REMINDER_TIMES],
    updatedAt: now,
  }
}

async function getOrNullSettings(
  ctx: SessionCtx,
  userId: string,
): Promise<Doc<'hydrationSettings'> | null> {
  return ctx.db
    .query('hydrationSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
}

async function ensureSettings(
  ctx: MutationCtx,
  userId: string,
  now: number,
): Promise<Doc<'hydrationSettings'>> {
  const existing = await getOrNullSettings(ctx, userId)
  if (existing) return existing
  const id = await ctx.db.insert('hydrationSettings', defaultSettings(userId, now))
  const row = await ctx.db.get(id)
  if (!row) throw new Error('HYDRATION_SETTINGS_CREATE_FAILED')
  return row
}

async function findHydrationByClientId(
  ctx: SessionCtx,
  userId: string,
  clientId: string,
): Promise<Doc<'hydrationEntries'> | null> {
  return ctx.db
    .query('hydrationEntries')
    .withIndex('by_user_client', (q) => q.eq('userId', userId).eq('clientId', clientId))
    .first()
}

/** Entrées eau legacy Convex (nutrition_water_entries) actives pour un jour. */
async function listLegacyWaterRows(
  ctx: SessionCtx,
  userId: string,
  dayKey: string,
): Promise<Doc<'nutrition_water_entries'>[]> {
  const rows = await ctx.db
    .query('nutrition_water_entries')
    .withIndex('by_userId_dateKey', (q) => q.eq('userId', userId).eq('dateKey', dayKey))
    .collect()
  return rows.filter((r) => r.deletedAt == null && Math.round(r.amountMl) > 0)
}

/**
 * M1 — somme hydration* + legacy non encore migrée (jamais de double compte :
 * si `legacy:${entryId}` existe déjà dans hydrationEntries, l’entrée legacy est ignorée).
 */
async function sumDrunkMl(
  ctx: SessionCtx,
  userId: string,
  dayKey: string,
): Promise<number> {
  const rows = await ctx.db
    .query('hydrationEntries')
    .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('dayKey', dayKey))
    .collect()
  let total = 0
  for (const row of rows) {
    if (row.undoneAt != null) continue
    total += Math.max(0, Math.round(row.amountMl))
  }

  const legacyRows = await listLegacyWaterRows(ctx, userId, dayKey)
  for (const leg of legacyRows) {
    const clientId = legacyWaterEntryClientId(leg.entryId)
    const migrated = await findHydrationByClientId(ctx, userId, clientId)
    if (migrated && migrated.undoneAt == null) continue
    if (migrated && migrated.undoneAt != null) {
      // Migrée puis annulée : ne pas recompter le legacy (évite résurrection).
      continue
    }
    total += Math.max(0, Math.round(leg.amountMl))
  }
  return total
}

/**
 * M1-a — insert hydrationEntries si clientId absent ; sinon skip (idempotent / retry-safe).
 */
async function insertHydrationIfAbsent(
  ctx: MutationCtx,
  input: {
    userId: string
    dayKey: string
    amountMl: number
    source: HydrationEntrySource
    clientId: string
    createdAt: number
  },
): Promise<{ inserted: boolean; entryId: string }> {
  const existing = await findHydrationByClientId(ctx, input.userId, input.clientId)
  if (existing) {
    return { inserted: false, entryId: existing._id }
  }
  const entryId = await ctx.db.insert('hydrationEntries', {
    userId: input.userId,
    dayKey: input.dayKey,
    amountMl: input.amountMl,
    source: input.source,
    clientId: input.clientId,
    createdAt: input.createdAt,
  })
  // Re-check après insert (course migrate + addEntry même clientId).
  const again = await ctx.db
    .query('hydrationEntries')
    .withIndex('by_user_client', (q) =>
      q.eq('userId', input.userId).eq('clientId', input.clientId),
    )
    .collect()
  if (again.length > 1) {
    // Garde-fou : conserver la plus ancienne, soft-undo les doublons.
    again.sort((a, b) => a.createdAt - b.createdAt)
    for (let i = 1; i < again.length; i += 1) {
      const dup = again[i]
      if (dup && dup.undoneAt == null) {
        await ctx.db.patch(dup._id, { undoneAt: input.createdAt })
      }
    }
    return { inserted: false, entryId: again[0]!._id }
  }
  return { inserted: true, entryId }
}

/**
 * M1 — copie idempotente nutrition_water_entries → hydrationEntries (clientId stable).
 * Rejouable sans effet / sans doublon.
 */
async function migrateLegacyWaterDay(
  ctx: MutationCtx,
  userId: string,
  dayKey: string,
  now: number,
): Promise<number> {
  const legacyRows = await listLegacyWaterRows(ctx, userId, dayKey)
  let inserted = 0
  for (const leg of legacyRows) {
    const amountMl = Math.max(0, Math.round(leg.amountMl))
    if (amountMl < ENTRY_MIN_ML || amountMl > ENTRY_MAX_ML) continue
    const clientId = legacyWaterEntryClientId(leg.entryId)
    const result = await insertHydrationIfAbsent(ctx, {
      userId,
      dayKey,
      amountMl,
      source: 'slider',
      clientId,
      createdAt: typeof leg.createdAt === 'number' ? leg.createdAt : now,
    })
    if (result.inserted) inserted += 1
  }
  return inserted
}

async function migrateLegacyWaterWindow(
  ctx: MutationCtx,
  userId: string,
  endDayKey: string,
  now: number,
): Promise<{ days: number; inserted: number }> {
  const keys = lastNDayKeys(endDayKey, 7)
  let inserted = 0
  for (const dayKey of keys) {
    inserted += await migrateLegacyWaterDay(ctx, userId, dayKey, now)
  }
  return { days: keys.length, inserted }
}

async function loadNutritionAge(ctx: SessionCtx, userId: string): Promise<number | null> {
  const nutrition = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  return extractStoredNutritionAge(nutrition?.profileJson)
}

async function resolveEffectiveGoalMl(
  ctx: SessionCtx,
  userId: string,
  storedGoalMl: number,
): Promise<number> {
  const age = await loadNutritionAge(ctx, userId)
  return effectiveHydrationGoalMl(storedGoalMl, age)
}

async function isGoalLockedForUser(ctx: SessionCtx, userId: string): Promise<boolean> {
  const age = await loadNutritionAge(ctx, userId)
  return age == null || age < NUTRITION_ADULT_MIN
}

/**
 * Mutations : normalise goalMl stocké à 1500 si mineur/inconnu (ancienne cible 3000, etc.).
 */
async function normalizeStoredGoalIfLocked(
  ctx: MutationCtx,
  userId: string,
  settings: Doc<'hydrationSettings'>,
  now: number,
): Promise<Doc<'hydrationSettings'>> {
  const locked = await isGoalLockedForUser(ctx, userId)
  if (!locked || settings.goalMl === GOAL_DEFAULT_ML) return settings
  await ctx.db.patch(settings._id, { goalMl: GOAL_DEFAULT_ML, updatedAt: now })
  const next = await ctx.db.get(settings._id)
  return next ?? { ...settings, goalMl: GOAL_DEFAULT_ML }
}

async function lastUndoableEntry(
  ctx: SessionCtx,
  userId: string,
  dayKey: string,
): Promise<Doc<'hydrationEntries'> | null> {
  const rows = await ctx.db
    .query('hydrationEntries')
    .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('dayKey', dayKey))
    .collect()
  const active = rows.filter((r) => r.undoneAt == null)
  if (active.length === 0) return null
  active.sort((a, b) => b.createdAt - a.createdAt)
  return active[0] ?? null
}

function assertAmountMl(amountMl: number): void {
  if (
    !Number.isFinite(amountMl)
    || !Number.isInteger(amountMl)
    || amountMl < ENTRY_MIN_ML
    || amountMl > ENTRY_MAX_ML
  ) {
    throw new Error('HYDRATION_AMOUNT_OUT_OF_RANGE')
  }
}

function assertGoalMl(goalMl: number): void {
  if (
    !Number.isFinite(goalMl)
    || !Number.isInteger(goalMl)
    || goalMl < GOAL_MIN_ML
    || goalMl > GOAL_MAX_ML
  ) {
    throw new Error('HYDRATION_GOAL_OUT_OF_RANGE')
  }
}

function assertContainerMl(ml: number): void {
  if (
    !Number.isFinite(ml)
    || !Number.isInteger(ml)
    || ml < CONTAINER_MIN_ML
    || ml > CONTAINER_MAX_ML
  ) {
    throw new Error('HYDRATION_CONTAINER_OUT_OF_RANGE')
  }
}

function assertReminderTimes(times: string[]): void {
  if (times.length > REMINDERS_MAX_PER_DAY) {
    throw new Error('HYDRATION_TOO_MANY_REMINDERS')
  }
  const seen = new Set<string>()
  for (const t of times) {
    if (!isReminderTimeAllowed(t)) throw new Error('HYDRATION_REMINDER_NIGHT_FORBIDDEN')
    if (seen.has(t)) throw new Error('HYDRATION_REMINDER_DUPLICATE')
    seen.add(t)
  }
}

function assertMode(mode: string): asserts mode is HydrationMode {
  if (!(HYDRATION_MODES as readonly string[]).includes(mode)) {
    throw new Error('HYDRATION_INVALID_MODE')
  }
}

function assertSource(source: string): asserts source is HydrationEntrySource {
  if (!(HYDRATION_ENTRY_SOURCES as readonly string[]).includes(source)) {
    throw new Error('HYDRATION_INVALID_SOURCE')
  }
}

export type HydrationTodayView = {
  dayKey: string
  mode: HydrationMode
  goalMl: number
  drunkMl: number
  remainingMl: number
  showHighInfo: boolean
  myBottleVolumeMl: number | null
  myBottleHasShape: boolean
  /** Cosmétique Pro actif — sinon rendu 2 L même si mode my_bottle. */
  proActive: boolean
  effectiveVisualMode: HydrationMode
  remindersEnabled: boolean
  reminderTimes: string[]
  canUndo: boolean
  lastEntryId: string | null
  glassMl: number
  classicBottleMl: number
  labelEauBueSeule: true
}

function toTodayView(
  settings: Doc<'hydrationSettings'> | Omit<Doc<'hydrationSettings'>, '_id' | '_creationTime'>,
  dayKey: string,
  drunk: number,
  last: Doc<'hydrationEntries'> | null,
  proActive: boolean,
  goalMlOverride?: number,
): HydrationTodayView {
  const mode = settings.mode
  const visual: HydrationMode =
    mode === 'my_bottle' && !proActive ? 'classic_2l' : mode
  const goalMl = goalMlOverride ?? settings.goalMl
  return {
    dayKey,
    mode,
    goalMl,
    drunkMl: drunk,
    remainingMl: remainingMl(goalMl, drunk),
    showHighInfo: showHighInfo(drunk),
    myBottleVolumeMl: settings.myBottleVolumeMl ?? null,
    myBottleHasShape: settings.myBottleHasShape,
    proActive,
    effectiveVisualMode: visual,
    remindersEnabled: settings.remindersEnabled,
    reminderTimes: settings.reminderTimes,
    canUndo: last != null,
    lastEntryId: last?._id ?? null,
    glassMl: GLASS_ML,
    classicBottleMl: CLASSIC_BOTTLE_ML,
    labelEauBueSeule: true,
  }
}

async function buildTodayView(
  ctx: SessionCtx,
  userId: string,
  settings: Doc<'hydrationSettings'> | Omit<Doc<'hydrationSettings'>, '_id' | '_creationTime'>,
  dayKey: string,
  now?: number,
): Promise<HydrationTodayView> {
  const drunk = await sumDrunkMl(ctx, userId, dayKey)
  const last = await lastUndoableEntry(ctx, userId, dayKey)
  const proActive = await hasActivePro(ctx, userId, now)
  const goalMl = await resolveEffectiveGoalMl(ctx, userId, settings.goalMl)
  return toTodayView(settings, dayKey, drunk, last, proActive, goalMl)
}

export const getToday = query({
  args: {
    sessionToken: v.string(),
    dayKey: v.string(),
  },
  handler: async (ctx, args): Promise<HydrationTodayView> => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (!isValidDayKey(args.dayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    const settings = await getOrNullSettings(ctx, user.userId)
    const effective = settings ?? defaultSettings(user.userId, Date.now())
    return buildTodayView(ctx, user.userId, effective, args.dayKey)
  },
})

export const getHistory = query({
  args: {
    sessionToken: v.string(),
    endDayKey: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{ dayKey: string; drunkMl: number }>> => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (!isValidDayKey(args.endDayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    const keys = lastNDayKeys(args.endDayKey, 7)
    const out: Array<{ dayKey: string; drunkMl: number }> = []
    for (const dayKey of keys) {
      out.push({ dayKey, drunkMl: await sumDrunkMl(ctx, user.userId, dayKey) })
    }
    return out
  },
})

/**
 * M1 — migre nutrition_water_entries → hydrationEntries (7 j), idempotent.
 * À appeler au chargement WaterCard / sync.
 */
export const migrateLegacyWater = mutation({
  args: {
    sessionToken: v.string(),
    endDayKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    if (!isValidDayKey(args.endDayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    await ensureSettings(ctx, user.userId, now)
    const result = await migrateLegacyWaterWindow(ctx, user.userId, args.endDayKey, now)
    const settings = await normalizeStoredGoalIfLocked(
      ctx,
      user.userId,
      (await getOrNullSettings(ctx, user.userId))!,
      now,
    )
    const today = await buildTodayView(ctx, user.userId, settings, args.endDayKey, now)
    return { ...result, today }
  },
})

export const addEntry = mutation({
  args: {
    sessionToken: v.string(),
    clientId: v.string(),
    dayKey: v.string(),
    amountMl: v.number(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    if (!isValidDayKey(args.dayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    // M1-b — legacy:* sur fenêtre 7 j ; ajouts courants ±1 jour.
    const serverDayKey = (() => {
      const d = new Date(now)
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()
    const dayAllowed = isLegacyHydrationClientId(args.clientId)
      ? isDayKeyWithinLegacyMigrationWindow(args.dayKey, serverDayKey)
      : isDayKeyWithinTolerance(args.dayKey, now)
    if (!dayAllowed) throw new Error('HYDRATION_INVALID_DAY_KEY')
    if (typeof args.clientId !== 'string' || args.clientId.length < 8 || args.clientId.length > 128) {
      throw new Error('HYDRATION_INVALID_CLIENT_ID')
    }
    assertSource(args.source)
    assertAmountMl(args.amountMl)

    let settings = await ensureSettings(ctx, user.userId, now)
    settings = await normalizeStoredGoalIfLocked(ctx, user.userId, settings, now)

    // M1-a — upsert/skip : si clientId déjà présent, pas de 2e insert.
    const existing = await findHydrationByClientId(ctx, user.userId, args.clientId)
    if (existing) {
      return {
        duplicate: true as const,
        entryId: existing._id,
        today: await buildTodayView(ctx, user.userId, settings, args.dayKey, now),
      }
    }

    // Reprise legacy table avant nouvel ajout (évite total 0).
    await migrateLegacyWaterDay(ctx, user.userId, args.dayKey, now)

    // M1-a — re-check après migrate (même clientId legacy: peut venir d’être créé).
    const afterMigrate = await insertHydrationIfAbsent(ctx, {
      userId: user.userId,
      dayKey: args.dayKey,
      amountMl: args.amountMl,
      source: args.source,
      clientId: args.clientId,
      createdAt: now,
    })
    return {
      duplicate: !afterMigrate.inserted,
      entryId: afterMigrate.entryId,
      today: await buildTodayView(ctx, user.userId, settings, args.dayKey, now),
    }
  },
})

/**
 * M1-b — import batch journal local (fenêtre 7 j), upsert par clientId.
 * Ne passe pas par la tolérance ±1 des ajouts courants.
 */
export const importLegacyLocalEntries = mutation({
  args: {
    sessionToken: v.string(),
    endDayKey: v.string(),
    entries: v.array(
      v.object({
        clientId: v.string(),
        dayKey: v.string(),
        amountMl: v.number(),
        createdAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    if (!isValidDayKey(args.endDayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    await ensureSettings(ctx, user.userId, now)

    let inserted = 0
    let skipped = 0
    const rejected: Array<{ clientId: string; dayKey: string; reason: string }> = []

    for (const entry of args.entries) {
      if (!isLegacyHydrationClientId(entry.clientId)) {
        rejected.push({
          clientId: entry.clientId,
          dayKey: entry.dayKey,
          reason: 'HYDRATION_NOT_LEGACY_CLIENT_ID',
        })
        continue
      }
      if (
        !isValidDayKey(entry.dayKey)
        || !isDayKeyWithinLegacyMigrationWindow(entry.dayKey, args.endDayKey)
      ) {
        rejected.push({
          clientId: entry.clientId,
          dayKey: entry.dayKey,
          reason: 'HYDRATION_INVALID_DAY_KEY',
        })
        continue
      }
      const amountMl = Math.round(entry.amountMl)
      if (
        !Number.isFinite(amountMl)
        || !Number.isInteger(amountMl)
        || amountMl < ENTRY_MIN_ML
        || amountMl > ENTRY_MAX_ML
      ) {
        rejected.push({
          clientId: entry.clientId,
          dayKey: entry.dayKey,
          reason: 'HYDRATION_AMOUNT_OUT_OF_RANGE',
        })
        continue
      }
      const result = await insertHydrationIfAbsent(ctx, {
        userId: user.userId,
        dayKey: entry.dayKey,
        amountMl,
        source: 'slider',
        clientId: entry.clientId,
        createdAt: entry.createdAt ?? now,
      })
      if (result.inserted) inserted += 1
      else skipped += 1
    }

    return {
      inserted,
      skipped,
      rejected,
      ok: rejected.length === 0,
    }
  },
})

export const undoLast = mutation({
  args: {
    sessionToken: v.string(),
    dayKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    if (!isValidDayKey(args.dayKey)) throw new Error('HYDRATION_INVALID_DAY_KEY')
    const last = await lastUndoableEntry(ctx, user.userId, args.dayKey)
    if (!last) throw new Error('HYDRATION_NOTHING_TO_UNDO')
    await ctx.db.patch(last._id, { undoneAt: now })
    let settings = await ensureSettings(ctx, user.userId, now)
    settings = await normalizeStoredGoalIfLocked(ctx, user.userId, settings, now)
    return buildTodayView(ctx, user.userId, settings, args.dayKey, now)
  },
})

export const updateSettings = mutation({
  args: {
    sessionToken: v.string(),
    mode: v.optional(modeValidator),
    goalMl: v.optional(v.number()),
    myBottleVolumeMl: v.optional(v.number()),
    remindersEnabled: v.optional(v.boolean()),
    reminderTimes: v.optional(v.array(v.string())),
    onboardedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    const settings = await ensureSettings(ctx, user.userId, now)
    const patch: Partial<Doc<'hydrationSettings'>> = { updatedAt: now }

    if (args.mode !== undefined) {
      assertMode(args.mode)
      if (args.mode === 'my_bottle') {
        const pro = await hasActivePro(ctx, user.userId, now)
        if (!pro) throw new Error('HYDRATION_PRO_REQUIRED')
        const volume = args.myBottleVolumeMl ?? settings.myBottleVolumeMl
        if (volume == null) throw new Error('HYDRATION_BOTTLE_VOLUME_REQUIRED')
        assertContainerMl(volume)
        patch.myBottleVolumeMl = volume
      }
      patch.mode = args.mode
    }

    if (args.goalMl !== undefined) {
      // M7 — mineurs / âge inconnu : objectif non réglable.
      if (await isGoalLockedForUser(ctx, user.userId)) {
        throw new Error('HYDRATION_GOAL_LOCKED_MINOR')
      }
      assertGoalMl(args.goalMl)
      patch.goalMl = clampGoalMl(args.goalMl)
    }

    if (args.myBottleVolumeMl !== undefined) {
      assertContainerMl(args.myBottleVolumeMl)
      patch.myBottleVolumeMl = args.myBottleVolumeMl
    }

    if (args.remindersEnabled !== undefined) {
      patch.remindersEnabled = args.remindersEnabled
    }

    if (args.reminderTimes !== undefined) {
      assertReminderTimes(args.reminderTimes)
      patch.reminderTimes = args.reminderTimes
    }

    if (args.onboardedAt !== undefined) {
      patch.onboardedAt = args.onboardedAt
    }

    await ctx.db.patch(settings._id, patch)
    let next = await ctx.db.get(settings._id)
    if (!next) throw new Error('HYDRATION_SETTINGS_MISSING')
    next = await normalizeStoredGoalIfLocked(ctx, user.userId, next, now)
    const proActive = await hasActivePro(ctx, user.userId, now)
    const goalMl = await resolveEffectiveGoalMl(ctx, user.userId, next.goalMl)
    return {
      settings: { ...next, goalMl },
      proActive,
      effectiveGoalMl: goalMl,
      effectiveVisualMode:
        next.mode === 'my_bottle' && !proActive ? ('classic_2l' as const) : next.mode,
    }
  },
})

export const setBottleShapeFlag = mutation({
  args: {
    sessionToken: v.string(),
    hasShape: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    const settings = await ensureSettings(ctx, user.userId, now)
    await ctx.db.patch(settings._id, {
      myBottleHasShape: args.hasShape,
      updatedAt: now,
    })
    return { ok: true as const }
  },
})

export const deleteMyBottle = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    const settings = await ensureSettings(ctx, user.userId, now)
    await ctx.db.patch(settings._id, {
      myBottleHasShape: false,
      mode: 'classic_2l',
      updatedAt: now,
    })
    return { ok: true as const, mode: 'classic_2l' as const }
  },
})

/**
 * B1 — grant Pro cosmétique réservé au serveur (tests/seed).
 * Jamais exposé via `api.*` : `internalMutation` uniquement.
 * Délègue à `setProEntitlementForTests` → projection `subscriptionAccess`
 * (un flag `proEntitlements` seul ne donne plus le Pro).
 */
export const setProForTests = internalMutation({
  args: {
    userId: v.string(),
    activeUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const { setProEntitlementForTests } = await import('./lib/proEntitlement')
    await setProEntitlementForTests(ctx, args.userId, args.activeUntil)
    return { ok: true as const }
  },
})
