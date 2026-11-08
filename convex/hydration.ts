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
  return total
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
): HydrationTodayView {
  const mode = settings.mode
  const visual: HydrationMode =
    mode === 'my_bottle' && !proActive ? 'classic_2l' : mode
  return {
    dayKey,
    mode,
    goalMl: settings.goalMl,
    drunkMl: drunk,
    remainingMl: remainingMl(settings.goalMl, drunk),
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
    const drunk = await sumDrunkMl(ctx, user.userId, args.dayKey)
    const last = await lastUndoableEntry(ctx, user.userId, args.dayKey)
    const proActive = await hasActivePro(ctx, user.userId)
    return toTodayView(effective, args.dayKey, drunk, last, proActive)
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
    if (!isValidDayKey(args.dayKey) || !isDayKeyWithinTolerance(args.dayKey, now)) {
      throw new Error('HYDRATION_INVALID_DAY_KEY')
    }
    if (typeof args.clientId !== 'string' || args.clientId.length < 8 || args.clientId.length > 128) {
      throw new Error('HYDRATION_INVALID_CLIENT_ID')
    }
    assertSource(args.source)
    assertAmountMl(args.amountMl)

    const dup = await ctx.db
      .query('hydrationEntries')
      .withIndex('by_user_client', (q) =>
        q.eq('userId', user.userId).eq('clientId', args.clientId),
      )
      .first()
    if (dup) {
      const settings = await ensureSettings(ctx, user.userId, now)
      const drunk = await sumDrunkMl(ctx, user.userId, args.dayKey)
      const last = await lastUndoableEntry(ctx, user.userId, args.dayKey)
      const proActive = await hasActivePro(ctx, user.userId, now)
      return {
        duplicate: true as const,
        entryId: dup._id,
        today: toTodayView(settings, args.dayKey, drunk, last, proActive),
      }
    }

    await ensureSettings(ctx, user.userId, now)
    const entryId = await ctx.db.insert('hydrationEntries', {
      userId: user.userId,
      dayKey: args.dayKey,
      amountMl: args.amountMl,
      source: args.source,
      clientId: args.clientId,
      createdAt: now,
    })
    const settings = await ensureSettings(ctx, user.userId, now)
    const drunk = await sumDrunkMl(ctx, user.userId, args.dayKey)
    const last = await lastUndoableEntry(ctx, user.userId, args.dayKey)
    const proActive = await hasActivePro(ctx, user.userId, now)
    return {
      duplicate: false as const,
      entryId,
      today: toTodayView(settings, args.dayKey, drunk, last, proActive),
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
    const settings = await ensureSettings(ctx, user.userId, now)
    const drunk = await sumDrunkMl(ctx, user.userId, args.dayKey)
    const nextLast = await lastUndoableEntry(ctx, user.userId, args.dayKey)
    const proActive = await hasActivePro(ctx, user.userId, now)
    return toTodayView(settings, args.dayKey, drunk, nextLast, proActive)
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
      // M7 — mineurs / âge inconnu : objectif non réglable (défaut serveur conservé).
      const nutrition = await ctx.db
        .query('nutrition_state')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .first()
      const age = extractStoredNutritionAge(nutrition?.profileJson)
      const goalLocked = age == null || age < NUTRITION_ADULT_MIN
      if (goalLocked) {
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
    const next = await ctx.db.get(settings._id)
    if (!next) throw new Error('HYDRATION_SETTINGS_MISSING')
    const proActive = await hasActivePro(ctx, user.userId, now)
    return {
      settings: next,
      proActive,
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
 */
export const setProForTests = internalMutation({
  args: {
    userId: v.string(),
    activeUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('proEntitlements')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { activeUntil: args.activeUntil, updatedAt: now })
    } else {
      await ctx.db.insert('proEntitlements', {
        userId: args.userId,
        activeUntil: args.activeUntil,
        updatedAt: now,
      })
    }
    return { ok: true as const }
  },
})
