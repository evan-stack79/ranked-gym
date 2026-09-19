import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

/**
 * Cloud backup/sync for PR-F domains: profile lobby, workouts, nutrition
 * (hydration nested in journal), sleep, plus optional streak snapshot.
 *
 * Isolation: session user is the only trusted userId. Client-supplied userId
 * is ignored.
 *
 * Overwrite protection: refuse to replace meaningful server data with an
 * empty/blank local payload (pull-first companion to the client `cloudSyncReady` gate).
 */

export type SyncSleepNight = {
  dateKey: string
  bedtime: string
  waketime: string
  tstHours: number | null
  createdAt: number
  updatedAt: number
}

export type SyncLobby = {
  customGyms: unknown
  checkIn: unknown
}

export type SyncSnapshot = {
  serverVersion: number
  updatedAt: number
  profile: {
    userId: string
    pseudo: string
    level: number
    xp: number
    rank: string
    discipline: string
    isGhostModeEnabled: boolean
    avatarFileId?: string
    createdAt: number
    updatedAt: number
  } | null
  streak: {
    currentStreak: number
    lastLoginDate: string | null
    updatedAt: number
  } | null
  workouts: {
    stateJson: unknown
    progressJson: unknown
    updatedAt: number
  } | null
  nutrition: {
    profileJson: unknown
    journalJson: unknown
    updatedAt: number
  } | null
  sleep: SyncSleepNight[]
  lobby: SyncLobby
}

export type SyncPushInput = {
  clientMutationId?: string
  baseUpdatedAt?: number
  nutrition?: { profileJson?: unknown; journalJson?: unknown } | null
  workouts?: { stateJson?: unknown; progressJson?: unknown } | null
  sleep?: Array<{
    dateKey: string
    bedtime: string
    waketime: string
    tstHours: number | null
    createdAt?: number
  }> | null
  lobby?: SyncLobby | null
  streak?: { currentStreak: number; lastLoginDate: string | null } | null
}

export type SyncPushResult = {
  applied: boolean
  skippedEmptyOverwrite: boolean
  stale: boolean
  serverVersion: number
  updatedAt: number
  clientMutationId?: string
}

const sleepNightValidator = v.object({
  dateKey: v.string(),
  bedtime: v.string(),
  waketime: v.string(),
  tstHours: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const snapshotValidator = v.object({
  serverVersion: v.number(),
  updatedAt: v.number(),
  profile: v.union(
    v.object({
      userId: v.string(),
      pseudo: v.string(),
      level: v.number(),
      xp: v.number(),
      rank: v.string(),
      discipline: v.string(),
      isGhostModeEnabled: v.boolean(),
      avatarFileId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  streak: v.union(
    v.object({
      currentStreak: v.number(),
      lastLoginDate: v.union(v.string(), v.null()),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  workouts: v.union(
    v.object({
      stateJson: v.any(),
      progressJson: v.any(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  nutrition: v.union(
    v.object({
      profileJson: v.any(),
      journalJson: v.any(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  sleep: v.array(sleepNightValidator),
  lobby: v.object({
    customGyms: v.any(),
    checkIn: v.any(),
  }),
})

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function journalHasMeals(journalJson: unknown): boolean {
  const journal = asRecord(journalJson)
  if (!journal) return false
  return Object.values(journal).some((day) => {
    const row = asRecord(day)
    const meals = row?.meals
    return Array.isArray(meals) && meals.length > 0
  })
}

function journalHasWater(journalJson: unknown): boolean {
  const journal = asRecord(journalJson)
  if (!journal) return false
  return Object.values(journal).some((day) => {
    const row = asRecord(day)
    const water = row?.waterEntries
    return Array.isArray(water) && water.length > 0
  })
}

function arrayLen(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/** True when a payload would be unsafe to use as a blank-local overwrite. */
export function isMeaningfulSyncPayload(input: SyncPushInput): boolean {
  const nutritionProfile = asRecord(input.nutrition?.profileJson)
  const onboarded = Boolean(nutritionProfile?.onboardingComplete)
  const training = asRecord(input.workouts?.stateJson)
  const notes = arrayLen(training ? training.workoutNotes : undefined)
  const completed = arrayLen(training ? training.completed : undefined)
  const schedule = arrayLen(training ? training.schedule : undefined)
  const routinesList = training ? training.routines : undefined
  const routines = Array.isArray(routinesList)
    ? routinesList.some((routine) => {
        const row = asRecord(routine)
        return arrayLen(row ? row.exercises : undefined) > 0
      })
    : false
  const sleep = (input.sleep?.length ?? 0) > 0
  const spots = arrayLen(input.lobby?.customGyms)
  const checkIn = Boolean(asRecord(input.lobby?.checkIn)?.gym)
  const streak = (input.streak?.currentStreak ?? 0) > 0
  return (
    journalHasMeals(input.nutrition?.journalJson) ||
    journalHasWater(input.nutrition?.journalJson) ||
    notes > 0 ||
    completed > 0 ||
    schedule > 0 ||
    routines ||
    onboarded ||
    sleep ||
    spots > 0 ||
    checkIn ||
    streak
  )
}

async function findProfileDoc(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function findStreakDoc(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('streak_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function findWorkoutsDoc(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function findNutritionDoc(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function findActiveCheckinDoc(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('active_checkins')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

function maxUpdatedAt(values: Array<number | undefined>): number {
  const stamps = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return stamps.length > 0 ? Math.max(...stamps) : 0
}

export async function loadSyncSnapshotForSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<SyncSnapshot> {
  const user = await requireSessionUser(ctx, sessionToken)
  const [profile, streak, workouts, nutrition, sleepRows, spots, activeCheckin] = await Promise.all([
    findProfileDoc(ctx, user.userId),
    findStreakDoc(ctx, user.userId),
    findWorkoutsDoc(ctx, user.userId),
    findNutritionDoc(ctx, user.userId),
    ctx.db
      .query('sleep_nights')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', user.userId))
      .collect(),
    ctx.db
      .query('custom_spots')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', user.userId))
      .collect(),
    findActiveCheckinDoc(ctx, user.userId),
  ])

  if (profile) assertUserOwnership(profile.userId, user.userId)
  if (streak) assertUserOwnership(streak.userId, user.userId)
  if (workouts) assertUserOwnership(workouts.userId, user.userId)
  if (nutrition) assertUserOwnership(nutrition.userId, user.userId)
  for (const row of sleepRows) assertUserOwnership(row.userId, user.userId)
  for (const row of spots) assertUserOwnership(row.userId, user.userId)
  if (activeCheckin) assertUserOwnership(activeCheckin.userId, user.userId)

  const updatedAt = maxUpdatedAt([
    profile?.updatedAt,
    streak?.updatedAt,
    workouts?.updatedAt,
    nutrition?.updatedAt,
    ...sleepRows.map((row) => row.updatedAt),
    ...spots.map((row) => row.updatedAt),
    activeCheckin?.updatedAt,
  ])

  return {
    serverVersion: updatedAt,
    updatedAt,
    profile: profile
      ? {
          userId: profile.userId,
          pseudo: profile.pseudo,
          level: profile.level,
          xp: profile.xp,
          rank: profile.rank,
          discipline: profile.discipline,
          isGhostModeEnabled: profile.isGhostModeEnabled,
          avatarFileId: profile.avatarFileId ? String(profile.avatarFileId) : undefined,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }
      : null,
    streak: streak
      ? {
          currentStreak: streak.currentStreak,
          lastLoginDate: streak.lastLoginDate ?? null,
          updatedAt: streak.updatedAt,
        }
      : null,
    workouts: workouts
      ? {
          stateJson: workouts.stateJson,
          progressJson: workouts.progressJson,
          updatedAt: workouts.updatedAt,
        }
      : null,
    nutrition: nutrition
      ? {
          profileJson: nutrition.profileJson,
          journalJson: nutrition.journalJson,
          updatedAt: nutrition.updatedAt,
        }
      : null,
    sleep: sleepRows
      .map((row) => ({
        dateKey: row.dateKey,
        bedtime: row.bedtime,
        waketime: row.waketime,
        tstHours: row.tstHours,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    lobby: {
      customGyms: spots.map((spot) => ({
        id: spot.spotId,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        address: spot.address,
        ...(asRecord(spot.metadata) ?? {}),
      })),
      checkIn: activeCheckin?.checkinJson ?? null,
    },
  }
}

function snapshotToPushInput(snapshot: SyncSnapshot): SyncPushInput {
  return {
    nutrition: snapshot.nutrition
      ? { profileJson: snapshot.nutrition.profileJson, journalJson: snapshot.nutrition.journalJson }
      : null,
    workouts: snapshot.workouts
      ? { stateJson: snapshot.workouts.stateJson, progressJson: snapshot.workouts.progressJson }
      : null,
    sleep: snapshot.sleep,
    lobby: snapshot.lobby,
    streak: snapshot.streak
      ? { currentStreak: snapshot.streak.currentStreak, lastLoginDate: snapshot.streak.lastLoginDate }
      : null,
  }
}

async function upsertWorkouts(
  ctx: MutationCtx,
  userId: string,
  stateJson: unknown,
  progressJson: unknown,
  now: number,
) {
  const existing = await findWorkoutsDoc(ctx, userId)
  if (existing) {
    assertUserOwnership(existing.userId, userId)
    await ctx.db.patch(existing._id, { stateJson, progressJson, updatedAt: now })
    return
  }
  await ctx.db.insert('workouts_state', { userId, stateJson, progressJson, updatedAt: now })
}

async function upsertNutrition(
  ctx: MutationCtx,
  userId: string,
  profileJson: unknown,
  journalJson: unknown,
  now: number,
) {
  const existing = await findNutritionDoc(ctx, userId)
  if (existing) {
    assertUserOwnership(existing.userId, userId)
    await ctx.db.patch(existing._id, { profileJson, journalJson, updatedAt: now })
    return
  }
  await ctx.db.insert('nutrition_state', { userId, profileJson, journalJson, updatedAt: now })
}

async function replaceSleepNights(
  ctx: MutationCtx,
  userId: string,
  nights: NonNullable<SyncPushInput['sleep']>,
  now: number,
) {
  const existing = await ctx.db
    .query('sleep_nights')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const incomingKeys = new Set(nights.map((night) => night.dateKey))
  for (const row of existing) {
    assertUserOwnership(row.userId, userId)
    if (!incomingKeys.has(row.dateKey)) {
      await ctx.db.delete(row._id)
    }
  }
  for (const night of nights) {
    const found = existing.find((row) => row.dateKey === night.dateKey)
    const createdAt = night.createdAt ?? now
    if (found) {
      await ctx.db.patch(found._id, {
        bedtime: night.bedtime,
        waketime: night.waketime,
        tstHours: night.tstHours,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('sleep_nights', {
        userId,
        dateKey: night.dateKey,
        bedtime: night.bedtime,
        waketime: night.waketime,
        tstHours: night.tstHours,
        createdAt,
        updatedAt: now,
      })
    }
  }
}

function gymId(value: unknown, fallbackIndex: number): string {
  const row = asRecord(value)
  const id = row?.id
  if (typeof id === 'string' && id.trim()) return id
  return `spot-${fallbackIndex}`
}

async function replaceCustomSpots(
  ctx: MutationCtx,
  userId: string,
  customGyms: unknown,
  now: number,
) {
  const incoming = Array.isArray(customGyms) ? customGyms : []
  const existing = await ctx.db
    .query('custom_spots')
    .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
    .collect()
  const incomingIds = new Set(incoming.map((gym, index) => gymId(gym, index)))
  for (const row of existing) {
    assertUserOwnership(row.userId, userId)
    if (!incomingIds.has(row.spotId)) {
      await ctx.db.delete(row._id)
    }
  }
  for (let index = 0; index < incoming.length; index += 1) {
    const gym = incoming[index]
    const row = asRecord(gym) ?? {}
    const spotId = gymId(gym, index)
    const found = existing.find((candidate) => candidate.spotId === spotId)
    const name = typeof row.name === 'string' ? row.name : 'Spot'
    const lat = typeof row.lat === 'number' ? row.lat : 0
    const lng = typeof row.lng === 'number' ? row.lng : 0
    const address = typeof row.address === 'string' ? row.address : undefined
    const fields = {
      name,
      lat,
      lng,
      address,
      metadata: row,
      updatedAt: now,
    }
    if (found) {
      await ctx.db.patch(found._id, fields)
    } else {
      await ctx.db.insert('custom_spots', {
        userId,
        spotId,
        createdAt: now,
        ...fields,
      })
    }
  }
}

async function upsertActiveCheckin(
  ctx: MutationCtx,
  userId: string,
  checkIn: unknown,
  now: number,
) {
  const existing = await findActiveCheckinDoc(ctx, userId)
  if (checkIn == null) {
    if (existing) {
      assertUserOwnership(existing.userId, userId)
      await ctx.db.delete(existing._id)
    }
    return
  }
  if (existing) {
    assertUserOwnership(existing.userId, userId)
    await ctx.db.patch(existing._id, { checkinJson: checkIn, updatedAt: now })
    return
  }
  await ctx.db.insert('active_checkins', {
    userId,
    checkinJson: checkIn,
    updatedAt: now,
  })
}

export async function pushSyncForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: SyncPushInput,
): Promise<SyncPushResult> {
  const user = await requireSessionUser(ctx, sessionToken)
  const current = await loadSyncSnapshotForSession(ctx, sessionToken)
  const incomingMeaningful = isMeaningfulSyncPayload(input)
  const existingMeaningful = isMeaningfulSyncPayload(snapshotToPushInput(current))

  if (existingMeaningful && !incomingMeaningful) {
    return {
      applied: false,
      skippedEmptyOverwrite: true,
      stale: false,
      serverVersion: current.serverVersion,
      updatedAt: current.updatedAt,
      clientMutationId: input.clientMutationId,
    }
  }

  if (
    typeof input.baseUpdatedAt === 'number' &&
    current.updatedAt > 0 &&
    input.baseUpdatedAt < current.updatedAt
  ) {
    return {
      applied: false,
      skippedEmptyOverwrite: false,
      stale: true,
      serverVersion: current.serverVersion,
      updatedAt: current.updatedAt,
      clientMutationId: input.clientMutationId,
    }
  }

  const now = Date.now()
  if (input.nutrition) {
    await upsertNutrition(
      ctx,
      user.userId,
      input.nutrition.profileJson ?? {},
      input.nutrition.journalJson ?? {},
      now,
    )
  }
  if (input.workouts) {
    await upsertWorkouts(
      ctx,
      user.userId,
      input.workouts.stateJson ?? {},
      input.workouts.progressJson ?? {},
      now,
    )
  }
  if (input.sleep) {
    await replaceSleepNights(ctx, user.userId, input.sleep, now)
  }
  if (input.lobby) {
    await replaceCustomSpots(ctx, user.userId, input.lobby.customGyms, now)
    await upsertActiveCheckin(ctx, user.userId, input.lobby.checkIn, now)
  }
  if (input.streak) {
    const existing = await findStreakDoc(ctx, user.userId)
    const fields = {
      currentStreak: input.streak.currentStreak,
      lastLoginDate: input.streak.lastLoginDate,
      updatedAt: now,
    }
    if (existing) {
      assertUserOwnership(existing.userId, user.userId)
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert('streak_state', { userId: user.userId, ...fields })
    }
  }

  return {
    applied: true,
    skippedEmptyOverwrite: false,
    stale: false,
    serverVersion: now,
    updatedAt: now,
    clientMutationId: input.clientMutationId,
  }
}

export const bootstrapSync = query({
  args: {
    sessionToken: v.string(),
  },
  returns: snapshotValidator,
  handler: (ctx, args) => loadSyncSnapshotForSession(ctx, args.sessionToken),
})

export const pushSync = mutation({
  args: {
    sessionToken: v.string(),
    clientMutationId: v.optional(v.string()),
    baseUpdatedAt: v.optional(v.number()),
    nutrition: v.optional(
      v.object({
        profileJson: v.any(),
        journalJson: v.any(),
      }),
    ),
    workouts: v.optional(
      v.object({
        stateJson: v.any(),
        progressJson: v.any(),
      }),
    ),
    sleep: v.optional(
      v.array(
        v.object({
          dateKey: v.string(),
          bedtime: v.string(),
          waketime: v.string(),
          tstHours: v.union(v.number(), v.null()),
          createdAt: v.optional(v.number()),
        }),
      ),
    ),
    lobby: v.optional(
      v.object({
        customGyms: v.any(),
        checkIn: v.any(),
      }),
    ),
    streak: v.optional(
      v.object({
        currentStreak: v.number(),
        lastLoginDate: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.object({
    applied: v.boolean(),
    skippedEmptyOverwrite: v.boolean(),
    stale: v.boolean(),
    serverVersion: v.number(),
    updatedAt: v.number(),
    clientMutationId: v.optional(v.string()),
  }),
  handler: (ctx, args) =>
    pushSyncForSession(ctx, args.sessionToken, {
      clientMutationId: args.clientMutationId,
      baseUpdatedAt: args.baseUpdatedAt,
      nutrition: args.nutrition,
      workouts: args.workouts,
      sleep: args.sleep,
      lobby: args.lobby,
      streak: args.streak,
    }),
})
