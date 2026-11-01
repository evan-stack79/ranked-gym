import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import { getRankFromLevel } from './lib/progressionRank'
import { toProfileView, type ConvexProfileView } from './profiles'

const XP_PER_LEVEL = 1000
const XP_SESSION_CAP = 250
const RATING_FLOOR = 800
const RATING_CAP = 4000

const snapshotPayloadValidator = v.object({
  workoutStrain: v.union(v.number(), v.null()),
  strainZ: v.union(v.number(), v.null()),
  sleepBankMinutes: v.union(v.number(), v.null()),
  preparation: v.union(v.number(), v.null()),
  xpAwarded: v.number(),
  strainScale: v.number(),
  muscleFreshness: v.union(v.any(), v.null()),
})

const daySnapshotValidator = v.object({
  dateKey: v.string(),
  timezone: v.string(),
  inputsHash: v.string(),
  payload: snapshotPayloadValidator,
  computedAt: v.number(),
})

const awardValidator = v.object({
  applied: v.boolean(),
  noteId: v.string(),
  xp: v.number(),
  ratingBefore: v.number(),
  ratingAfter: v.number(),
  profile: v.any(),
})

export type DaySnapshotPayload = {
  workoutStrain: number | null
  strainZ: number | null
  sleepBankMinutes: number | null
  preparation: number | null
  xpAwarded: number
  strainScale: number
  muscleFreshness: Record<string, number> | null
}

export type DaySnapshotView = {
  dateKey: string
  timezone: string
  inputsHash: string
  payload: DaySnapshotPayload
  computedAt: number
}

function assertDateKey(dateKey: string): string {
  const trimmed = dateKey.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error('SNAPSHOT_DATE_INVALID')
  const [year, month, day] = trimmed.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error('SNAPSHOT_DATE_INVALID')
  }
  return trimmed
}

function assertBoundedText(value: string, code: string, max: number): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) throw new Error(code)
  return trimmed
}

function assertNullableScore(value: unknown, code: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(code)
  return value
}

export function parseSnapshotPayload(value: unknown): DaySnapshotPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SNAPSHOT_PAYLOAD_INVALID')
  }
  const record = value as Record<string, unknown>
  const xpAwarded = record.xpAwarded
  const strainScale = record.strainScale
  if (typeof xpAwarded !== 'number' || !Number.isInteger(xpAwarded) || xpAwarded < 0 || xpAwarded > XP_SESSION_CAP) {
    throw new Error('SNAPSHOT_PAYLOAD_INVALID')
  }
  if (typeof strainScale !== 'number' || !Number.isFinite(strainScale) || strainScale <= 0) {
    throw new Error('SNAPSHOT_PAYLOAD_INVALID')
  }
  let muscleFreshness: Record<string, number> | null = null
  if (record.muscleFreshness !== null && record.muscleFreshness !== undefined) {
    if (typeof record.muscleFreshness !== 'object' || Array.isArray(record.muscleFreshness)) {
      throw new Error('SNAPSHOT_PAYLOAD_INVALID')
    }
    muscleFreshness = {}
    for (const [muscle, score] of Object.entries(record.muscleFreshness as Record<string, unknown>)) {
      if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error('SNAPSHOT_PAYLOAD_INVALID')
      muscleFreshness[muscle] = score
    }
  }
  return {
    workoutStrain: assertNullableScore(record.workoutStrain, 'SNAPSHOT_PAYLOAD_INVALID'),
    strainZ: assertNullableScore(record.strainZ, 'SNAPSHOT_PAYLOAD_INVALID'),
    sleepBankMinutes: assertNullableScore(record.sleepBankMinutes, 'SNAPSHOT_PAYLOAD_INVALID'),
    preparation: assertNullableScore(record.preparation, 'SNAPSHOT_PAYLOAD_INVALID'),
    xpAwarded,
    strainScale,
    muscleFreshness,
  }
}

function applyXp(level: number, xp: number, gain: number): { level: number; xp: number } {
  let nextLevel = Math.max(1, Math.floor(level))
  let nextXp = Math.max(0, xp) + gain
  while (nextXp >= XP_PER_LEVEL) {
    nextXp -= XP_PER_LEVEL
    nextLevel += 1
  }
  return { level: nextLevel, xp: nextXp }
}

function clampRating(rating: number): number {
  if (!Number.isFinite(rating)) throw new Error('AWARD_RATING_INVALID')
  return Math.round(Math.min(RATING_CAP, Math.max(RATING_FLOOR, rating)))
}

async function findSnapshots(ctx: QueryCtx | MutationCtx, userId: string, dateKey: string) {
  return ctx.db
    .query('day_snapshots')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('dateKey', dateKey))
    .collect()
}

async function findAwards(ctx: QueryCtx | MutationCtx, userId: string, noteId: string) {
  return ctx.db
    .query('workout_xp_awards')
    .withIndex('by_user_note', (q) => q.eq('userId', userId).eq('noteId', noteId))
    .collect()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export async function upsertDaySnapshotForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    dateKey: string
    timezone: string
    inputsHash: string
    payload: unknown
  },
): Promise<{ updated: boolean; snapshot: DaySnapshotView }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const dateKey = assertDateKey(input.dateKey)
  const timezone = assertBoundedText(input.timezone, 'SNAPSHOT_TIMEZONE_INVALID', 64)
  const inputsHash = assertBoundedText(input.inputsHash, 'SNAPSHOT_HASH_INVALID', 128)
  const payload = parseSnapshotPayload(input.payload)
  const existing = await findSnapshots(ctx, user.userId, dateKey)
  for (const row of existing) assertUserOwnership(row.userId, user.userId)
  const current = existing[0]
  if (current && current.inputsHash === inputsHash) {
    return {
      updated: false,
      snapshot: {
        dateKey: current.dateKey,
        timezone: current.timezone,
        inputsHash: current.inputsHash,
        payload: parseSnapshotPayload(current.payload),
        computedAt: current.computedAt,
      },
    }
  }
  const computedAt = Date.now()
  if (current) {
    await ctx.db.patch(current._id, { timezone, inputsHash, payload, computedAt })
    for (const extra of existing.slice(1)) {
      await ctx.db.delete(extra._id)
    }
  } else {
    await ctx.db.insert('day_snapshots', {
      userId: user.userId,
      dateKey,
      timezone,
      inputsHash,
      payload,
      computedAt,
    })
  }
  return {
    updated: true,
    snapshot: { dateKey, timezone, inputsHash, payload, computedAt },
  }
}

export async function getDaySnapshotForSession(
  ctx: QueryCtx,
  sessionToken: string,
  dateKey: string,
): Promise<DaySnapshotView | null> {
  const user = await requireSessionUser(ctx, sessionToken)
  const key = assertDateKey(dateKey)
  const rows = await findSnapshots(ctx, user.userId, key)
  const row = rows[0]
  if (!row) return null
  assertUserOwnership(row.userId, user.userId)
  return {
    dateKey: row.dateKey,
    timezone: row.timezone,
    inputsHash: row.inputsHash,
    payload: parseSnapshotPayload(row.payload),
    computedAt: row.computedAt,
  }
}

export type WorkoutXpAwardResult = {
  applied: boolean
  noteId: string
  xp: number
  ratingBefore: number
  ratingAfter: number
  profile: ConvexProfileView
}

export async function awardWorkoutXpForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: { noteId: string; xp: number; performanceRating: number },
): Promise<WorkoutXpAwardResult> {
  const user = await requireSessionUser(ctx, sessionToken)
  const noteId = assertBoundedText(input.noteId, 'AWARD_NOTE_INVALID', 128)
  if (typeof input.xp !== 'number' || !Number.isInteger(input.xp) || input.xp < 0 || input.xp > XP_SESSION_CAP) {
    throw new Error('AWARD_XP_INVALID')
  }
  const ratingAfter = clampRating(input.performanceRating)
  const existing = await findAwards(ctx, user.userId, noteId)
  for (const row of existing) assertUserOwnership(row.userId, user.userId)
  const prior = existing[0]
  if (prior) {
    const profile = await toProfileView(ctx, user.userId)
    if (!profile) throw new Error('PROFILE_NOT_FOUND')
    return {
      applied: false,
      noteId,
      xp: prior.xp,
      ratingBefore: prior.ratingBefore,
      ratingAfter: prior.ratingAfter,
      profile,
    }
  }

  const profileRow = await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .first()
  if (!profileRow) throw new Error('PROFILE_NOT_FOUND')
  assertUserOwnership(profileRow.userId, user.userId)

  const ratingBefore = clampRating(profileRow.performanceRating ?? 1000)
  const progress = applyXp(profileRow.level, profileRow.xp, input.xp)
  const rank = getRankFromLevel(progress.level)
  const now = Date.now()
  await ctx.db.patch(profileRow._id, {
    level: progress.level,
    xp: progress.xp,
    rank: rank.tier,
    performanceRating: ratingAfter,
    ratedSessions: (profileRow.ratedSessions ?? 0) + 1,
    rankDivision: rank.division,
    updatedAt: now,
  })
  await ctx.db.insert('workout_xp_awards', {
    userId: user.userId,
    noteId,
    xp: input.xp,
    ratingBefore,
    ratingAfter,
    createdAt: now,
  })
  const raced = await findAwards(ctx, user.userId, noteId)
  if (raced.length > 1) {
    throw new Error('AWARD_IDEMPOTENT_RETRY')
  }
  const profile = await toProfileView(ctx, user.userId)
  if (!profile) throw new Error('PROFILE_NOT_FOUND')
  return {
    applied: true,
    noteId,
    xp: input.xp,
    ratingBefore,
    ratingAfter,
    profile,
  }
}

/**
 * Fusionne des clés dans workouts_state sans changer le schéma de la table
 * et sans effacer les clés absentes du patch (contrat v2 additif).
 */
export async function patchWorkoutsStateForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: { statePatch: unknown; progressPatch?: unknown },
): Promise<{ updatedAt: number }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const statePatch = asRecord(input.statePatch)
  if (!statePatch) throw new Error('WORKOUT_PATCH_INVALID')
  const progressPatch = input.progressPatch === undefined ? null : asRecord(input.progressPatch)
  if (input.progressPatch !== undefined && !progressPatch) throw new Error('WORKOUT_PATCH_INVALID')

  const existing = await ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .first()
  const now = Date.now()
  const prevState = asRecord(existing?.stateJson) ?? {}
  const prevProgress = asRecord(existing?.progressJson) ?? {}
  const stateJson = { ...prevState, ...statePatch }
  const progressJson = progressPatch ? { ...prevProgress, ...progressPatch } : prevProgress
  if (existing) {
    assertUserOwnership(existing.userId, user.userId)
    await ctx.db.patch(existing._id, { stateJson, progressJson, updatedAt: now })
  } else {
    await ctx.db.insert('workouts_state', {
      userId: user.userId,
      stateJson,
      progressJson,
      updatedAt: now,
    })
  }
  return { updatedAt: now }
}

export const upsertDaySnapshot = mutation({
  args: {
    sessionToken: v.string(),
    dateKey: v.string(),
    timezone: v.string(),
    inputsHash: v.string(),
    payload: v.any(),
  },
  returns: v.object({
    updated: v.boolean(),
    snapshot: daySnapshotValidator,
  }),
  handler: (ctx, args) =>
    upsertDaySnapshotForSession(ctx, args.sessionToken, {
      dateKey: args.dateKey,
      timezone: args.timezone,
      inputsHash: args.inputsHash,
      payload: args.payload,
    }),
})

export const getDaySnapshot = query({
  args: { sessionToken: v.string(), dateKey: v.string() },
  returns: v.union(daySnapshotValidator, v.null()),
  handler: (ctx, args) => getDaySnapshotForSession(ctx, args.sessionToken, args.dateKey),
})

export const awardWorkoutXp = mutation({
  args: {
    sessionToken: v.string(),
    noteId: v.string(),
    xp: v.number(),
    performanceRating: v.number(),
  },
  returns: awardValidator,
  handler: (ctx, args) =>
    awardWorkoutXpForSession(ctx, args.sessionToken, {
      noteId: args.noteId,
      xp: args.xp,
      performanceRating: args.performanceRating,
    }),
})

export const patchWorkoutsState = mutation({
  args: {
    sessionToken: v.string(),
    statePatch: v.any(),
    progressPatch: v.optional(v.any()),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: (ctx, args) =>
    patchWorkoutsStateForSession(ctx, args.sessionToken, {
      statePatch: args.statePatch,
      progressPatch: args.progressPatch,
    }),
})
