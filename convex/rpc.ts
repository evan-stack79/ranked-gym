import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import { consumeRateLimit } from './lib/rateLimit'

const ACTIVITY_TYPES = new Set(['pr', 'workout', 'checkin', 'rank_up', 'streak'])
const DEFAULT_WEEK_LABELS = ['S-3', 'S-2', 'S-1', 'Act.'] as const
const AI_MEAL_DAILY_LIMIT = 5

type ActivityType = 'pr' | 'workout' | 'checkin' | 'rank_up' | 'streak'

export type ConvexCheckinView = {
  id: string
  user_id: string
  salle_nom: string
  salle_lat: number | null
  salle_lng: number | null
  gym_payload: unknown
  created_at: string
}

export type ConvexSocialActivityRow = {
  id: string
  user_id: string
  pseudo: string
  activity_type: string
  action_text: string
  xp_earned: number
  distance_label: string | null
  created_at: string
  is_self: boolean
  is_ghost_mode_enabled: boolean
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const rLat1 = toRad(lat1)
  const rLat2 = toRad(lat2)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

function smoothDistanceLabel(distanceKm: number | null, isGhostModeEnabled: boolean): string | null {
  if (isGhostModeEnabled || distanceKm == null || !Number.isFinite(distanceKm)) return null
  if (distanceKm <= 3) return 'Dans ta zone'
  if (distanceKm <= 12) return 'Pres de toi'
  return null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

type StatsSet = {
  sessionDate: Date
  routineId: string
  exerciseName: string
  weightKg: number
  reps: number
}

async function getSessionUserId(ctx: QueryCtx | MutationCtx, sessionToken: string): Promise<string> {
  const user = await requireSessionUser(ctx, sessionToken)
  return user.userId
}

function mapCheckinRow(row: {
  _id: string
  userId: string
  salleNom: string
  salleLat?: number | null
  salleLng?: number | null
  gymPayload?: unknown
  createdAt: number
}): ConvexCheckinView {
  return {
    id: String(row._id),
    user_id: row.userId,
    salle_nom: row.salleNom,
    salle_lat: row.salleLat ?? null,
    salle_lng: row.salleLng ?? null,
    gym_payload: row.gymPayload ?? null,
    created_at: toIso(row.createdAt),
  }
}

function classifyBodyZone(routineId: string, exerciseName: string): 'upper' | 'lower' | 'other' {
  if (['upper', 'push', 'pull', 'pecs', 'dos', 'epaules', 'bras'].includes(routineId)) return 'upper'
  if (['lower', 'legs', 'jambes', 'fessiers'].includes(routineId)) return 'lower'
  if (
    /(squat|leg|jambe|cuiss|fessier|mollet|deadlift|soulev|fente|lunge|hip thrust|presse.*cuiss|hack squat|extension.*jambe|flexion.*jambe|calf)/i.test(
      exerciseName,
    )
  ) {
    return 'lower'
  }
  if (
    /(pec|poitrine|chest|epaule|shoulder|develop|bench|couch|curl|triceps|biceps|tirage|rowing|pull|push|lat|dos|fly|ecart|dip|presse|ohp|overhead|traction|pompe)/i.test(
      exerciseName,
    )
  ) {
    return 'upper'
  }
  return 'other'
}

function isBenchExerciseName(exerciseName: string): boolean {
  return /(develop|bench|couch|dc |dev couch)/i.test(exerciseName)
}

function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function getWeekStart(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay() || 7
  copy.setDate(copy.getDate() - day + 1)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function parseStatsSets(workoutState: unknown): StatsSet[] {
  const state = toObject(workoutState) ?? {}
  const notes = Array.isArray(state.workoutNotes) ? state.workoutNotes : []
  const parsed: StatsSet[] = []

  for (const rawNote of notes) {
    const note = toObject(rawNote)
    if (!note) continue
    const dateKey = typeof note.dateKey === 'string' ? note.dateKey : ''
    const sessionDate = parseDateKey(dateKey)
    if (!sessionDate) continue
    const routineId = String(note.routineId ?? '').toLowerCase()
    const exercises = Array.isArray(note.exercises) ? note.exercises : []
    for (const rawExercise of exercises) {
      const exercise = toObject(rawExercise)
      if (!exercise) continue
      const exerciseName = String(exercise.name ?? '').toLowerCase()
      const sets = Array.isArray(exercise.sets) ? exercise.sets : []
      for (const rawSet of sets) {
        const set = toObject(rawSet)
        if (!set) continue
        const weightKg = Math.max(0, toNumber(set.weightKg))
        const reps = Math.max(0, toNumber(set.reps))
        if (weightKg <= 0 || reps <= 0) continue
        parsed.push({
          sessionDate,
          routineId,
          exerciseName,
          weightKg,
          reps,
        })
      }
    }
  }
  return parsed
}

function parseSessionDates(workoutState: unknown): Date[] {
  const state = toObject(workoutState) ?? {}
  const notes = Array.isArray(state.workoutNotes) ? state.workoutNotes : []
  const dates: Date[] = []
  for (const rawNote of notes) {
    const note = toObject(rawNote)
    if (!note) continue
    const dateKey = typeof note.dateKey === 'string' ? note.dateKey : ''
    const date = parseDateKey(dateKey)
    if (date) dates.push(date)
  }
  return dates
}

export async function createCheckinForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    salleNom: string
    salleLat?: number | null
    salleLng?: number | null
    gymPayload?: unknown
  },
): Promise<ConvexCheckinView> {
  const userId = await getSessionUserId(ctx, sessionToken)
  await consumeRateLimit(ctx, 'createCheckin', { kind: 'userId', value: userId })
  const now = Date.now()
  const id = await ctx.db.insert('checkins', {
    userId,
    salleNom: input.salleNom.trim().slice(0, 160) || 'Salle',
    salleLat: input.salleLat ?? null,
    salleLng: input.salleLng ?? null,
    gymPayload: input.gymPayload ?? null,
    createdAt: now,
  })
  const row = await ctx.db.get(id)
  if (!row) throw new Error('CHECKIN_CREATE_FAILED')
  assertUserOwnership(row.userId, userId)
  return mapCheckinRow(row as never)
}

export async function listRecentCheckinsForSession(
  ctx: QueryCtx,
  sessionToken: string,
  limit = 20,
): Promise<ConvexCheckinView[]> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const rows = await ctx.db
    .query('checkins')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
    .collect()
  const safeLimit = clamp(limit, 1, 100)
  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, safeLimit)
    .map((row) => {
      assertUserOwnership(row.userId, userId)
      return mapCheckinRow(row as never)
    })
}

export async function countCheckinsForSession(
  ctx: QueryCtx,
  sessionToken: string,
): Promise<number> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const rows = await ctx.db
    .query('checkins')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
    .collect()
  return rows.length
}

export async function recordActivityForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    activityType: ActivityType
    actionText: string
    xpEarned?: number
    originLat?: number | null
    originLng?: number | null
  },
): Promise<string> {
  const userId = await getSessionUserId(ctx, sessionToken)
  await consumeRateLimit(ctx, 'recordActivity', { kind: 'userId', value: userId })
  if (!ACTIVITY_TYPES.has(input.activityType)) {
    throw new Error('ACTIVITY_TYPE_INVALID')
  }
  const lat = input.originLat ?? null
  const lng = input.originLng ?? null
  if (lat != null && (lat < -90 || lat > 90)) throw new Error('ACTIVITY_LAT_INVALID')
  if (lng != null && (lng < -180 || lng > 180)) throw new Error('ACTIVITY_LNG_INVALID')
  const id = await ctx.db.insert('activities', {
    userId,
    activityType: input.activityType,
    actionText: input.actionText.trim().slice(0, 280) || 'a realise une activite',
    xpEarned: clamp(Math.round(input.xpEarned ?? 0), 0, 10_000),
    originLat: lat,
    originLng: lng,
    createdAt: Date.now(),
  })
  return String(id)
}

export async function getSocialActivityFeed(
  ctx: QueryCtx,
  input: {
    sessionToken?: string
    viewerLat?: number | null
    viewerLng?: number | null
    radiusKm?: number
    limit?: number
  },
): Promise<ConvexSocialActivityRow[]> {
  const userId = input.sessionToken ? await getSessionUserId(ctx, input.sessionToken) : null
  const safeLimit = clamp(input.limit ?? 20, 1, 50)
  const radiusKm = clamp(input.radiusKm ?? 25, 1, 100)
  const rows = await ctx.db.query('activities').withIndex('by_createdAt').collect()
  const ordered = rows.sort((a, b) => b.createdAt - a.createdAt)

  const mapped: ConvexSocialActivityRow[] = []
  for (const row of ordered) {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', row.userId))
      .first()
    const isGhostModeEnabled = Boolean(profile?.isGhostModeEnabled)
    const isSelf = Boolean(userId && row.userId === userId)
    const hasViewerCoords =
      typeof input.viewerLat === 'number' &&
      Number.isFinite(input.viewerLat) &&
      typeof input.viewerLng === 'number' &&
      Number.isFinite(input.viewerLng)
    const hasOriginCoords =
      typeof row.originLat === 'number' &&
      Number.isFinite(row.originLat) &&
      typeof row.originLng === 'number' &&
      Number.isFinite(row.originLng)

    let distanceKm: number | null = null
    if (hasViewerCoords && hasOriginCoords) {
      distanceKm = haversineKm(
        input.viewerLat as number,
        input.viewerLng as number,
        Number(row.originLat),
        Number(row.originLng),
      )
    }
    const inRadius =
      isGhostModeEnabled ||
      !hasViewerCoords ||
      !hasOriginCoords ||
      (distanceKm != null && distanceKm <= radiusKm)
    if (!inRadius) continue

    mapped.push({
      id: String(row._id),
      user_id: row.userId,
      pseudo:
        isGhostModeEnabled && !isSelf
          ? 'Athlete Furtif'
          : (profile?.pseudo?.trim() || 'Athlete').slice(0, 64),
      activity_type: row.activityType,
      action_text: row.actionText,
      xp_earned: row.xpEarned,
      distance_label: smoothDistanceLabel(distanceKm, isGhostModeEnabled),
      created_at: toIso(row.createdAt),
      is_self: isSelf,
      is_ghost_mode_enabled: isGhostModeEnabled,
    })
    if (mapped.length >= safeLimit) break
  }

  return mapped
}

export async function getUserStatsForSession(ctx: QueryCtx, sessionToken: string): Promise<unknown> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const workouts = await ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  if (workouts) assertUserOwnership(workouts.userId, userId)

  const sets = parseStatsSets(workouts?.stateJson)
  const notes = parseSessionDates(workouts?.stateJson)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const recentCutoff = new Date(today)
  recentCutoff.setDate(recentCutoff.getDate() - 28)
  const olderCutoff = new Date(today)
  olderCutoff.setDate(olderCutoff.getDate() - 14)
  const weekStart = getWeekStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  const last7Cutoff = new Date(today)
  last7Cutoff.setDate(last7Cutoff.getDate() - 6)

  let upperVolume = 0
  let lowerVolume = 0
  let totalVolume = 0
  let max1rmRecent = 0
  let max1rmOlder = 0

  for (const set of sets) {
    if (set.sessionDate < recentCutoff) continue
    const est1rm = set.weightKg * (1 + set.reps / 30)
    const setVolume = set.weightKg * set.reps
    totalVolume += setVolume
    const zone = classifyBodyZone(set.routineId, set.exerciseName)
    if (zone === 'upper') upperVolume += setVolume
    if (zone === 'lower') lowerVolume += setVolume
    if (est1rm > max1rmRecent) max1rmRecent = est1rm
    if (set.sessionDate < olderCutoff && est1rm > max1rmOlder) max1rmOlder = est1rm
  }

  const weekStarts = DEFAULT_WEEK_LABELS.map((label, index) => {
    const start = new Date(weekStart)
    start.setDate(start.getDate() - (3 - index) * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { label, start, end }
  })

  const benchCurve = weekStarts.map(({ label, start, end }) => {
    let value = 0
    for (const set of sets) {
      if (!isBenchExerciseName(set.exerciseName)) continue
      if (set.sessionDate < start || set.sessionDate >= end) continue
      const est1rm = set.weightKg * (1 + set.reps / 30)
      if (est1rm > value) value = est1rm
    }
    return { label, value_kg: round1(value) }
  })

  const sessionsLast7 = notes.filter((date) => date >= last7Cutoff && date <= today).length
  const sessionsThisWeek = notes.filter((date) => date >= weekStart && date <= weekEnd).length

  const upperScore = Math.round(clamp((upperVolume / 25_000) * 100, 0, 100))
  const lowerScore = Math.round(clamp((lowerVolume / 25_000) * 100, 0, 100))
  const volumeScore = Math.round(clamp((totalVolume / 50_000) * 100, 0, 100))
  const forceScore =
    max1rmOlder > 0
      ? Math.round(clamp(50 + ((max1rmRecent - max1rmOlder) / max1rmOlder) * 100, 0, 100))
      : max1rmRecent > 0
        ? 55
        : 0
  const regulariteScore = Math.round(clamp((sessionsLast7 / 4) * 100, 0, 100))

  return {
    radar: {
      upper: upperScore,
      lower: lowerScore,
      force: forceScore,
      volume: volumeScore,
      regularite: regulariteScore,
    },
    bench_1rm_curve: benchCurve,
    weekly_sessions: {
      completed: sessionsThisWeek,
      target: 4,
    },
  }
}

export async function reserveAiMealScanForSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ allowed: boolean; scan_count: number; daily_limit: number }> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const now = Date.now()
  const dateOfScan = toDateKey(new Date(now))
  const row = await ctx.db
    .query('ai_usage_limits')
    .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', userId).eq('dateOfScan', dateOfScan))
    .first()

  if (!row) {
    await ctx.db.insert('ai_usage_limits', {
      userId,
      dateOfScan,
      scanCount: 1,
      updatedAt: now,
    })
    return { allowed: true, scan_count: 1, daily_limit: AI_MEAL_DAILY_LIMIT }
  }

  assertUserOwnership(row.userId, userId)
  if (row.scanCount >= AI_MEAL_DAILY_LIMIT) {
    return {
      allowed: false,
      scan_count: row.scanCount,
      daily_limit: AI_MEAL_DAILY_LIMIT,
    }
  }
  const nextCount = row.scanCount + 1
  await ctx.db.patch(row._id, { scanCount: nextCount, updatedAt: now })
  return { allowed: true, scan_count: nextCount, daily_limit: AI_MEAL_DAILY_LIMIT }
}

export async function releaseAiMealScanForSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<void> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const dateOfScan = toDateKey(new Date())
  const row = await ctx.db
    .query('ai_usage_limits')
    .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', userId).eq('dateOfScan', dateOfScan))
    .first()
  if (!row) return
  assertUserOwnership(row.userId, userId)
  if (row.scanCount <= 0) return
  await ctx.db.patch(row._id, { scanCount: row.scanCount - 1, updatedAt: Date.now() })
}

export async function getAiMealUsageTodayForSession(
  ctx: QueryCtx,
  sessionToken: string,
): Promise<{ scan_count: number; daily_limit: number }> {
  const userId = await getSessionUserId(ctx, sessionToken)
  const dateOfScan = toDateKey(new Date())
  const row = await ctx.db
    .query('ai_usage_limits')
    .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', userId).eq('dateOfScan', dateOfScan))
    .first()
  return {
    scan_count: row?.scanCount ?? 0,
    daily_limit: AI_MEAL_DAILY_LIMIT,
  }
}

export const createCheckin = mutation({
  args: {
    sessionToken: v.string(),
    salleNom: v.string(),
    salleLat: v.optional(v.union(v.number(), v.null())),
    salleLng: v.optional(v.union(v.number(), v.null())),
    gymPayload: v.optional(v.any()),
  },
  returns: v.object({
    id: v.string(),
    user_id: v.string(),
    salle_nom: v.string(),
    salle_lat: v.union(v.number(), v.null()),
    salle_lng: v.union(v.number(), v.null()),
    gym_payload: v.any(),
    created_at: v.string(),
  }),
  handler: (ctx, args) =>
    createCheckinForSession(ctx, args.sessionToken, {
      salleNom: args.salleNom,
      salleLat: args.salleLat,
      salleLng: args.salleLng,
      gymPayload: args.gymPayload,
    }),
})

export const listRecentCheckins = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      user_id: v.string(),
      salle_nom: v.string(),
      salle_lat: v.union(v.number(), v.null()),
      salle_lng: v.union(v.number(), v.null()),
      gym_payload: v.any(),
      created_at: v.string(),
    }),
  ),
  handler: (ctx, args) => listRecentCheckinsForSession(ctx, args.sessionToken, args.limit),
})

export const countCheckins = query({
  args: { sessionToken: v.string() },
  returns: v.number(),
  handler: (ctx, args) => countCheckinsForSession(ctx, args.sessionToken),
})

export const recordActivity = mutation({
  args: {
    sessionToken: v.string(),
    activityType: v.union(
      v.literal('pr'),
      v.literal('workout'),
      v.literal('checkin'),
      v.literal('rank_up'),
      v.literal('streak'),
    ),
    actionText: v.string(),
    xpEarned: v.optional(v.number()),
    originLat: v.optional(v.union(v.number(), v.null())),
    originLng: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.string(),
  handler: (ctx, args) =>
    recordActivityForSession(ctx, args.sessionToken, {
      activityType: args.activityType,
      actionText: args.actionText,
      xpEarned: args.xpEarned,
      originLat: args.originLat,
      originLng: args.originLng,
    }),
})

export const getSocialFeed = query({
  args: {
    sessionToken: v.optional(v.string()),
    viewerLat: v.optional(v.union(v.number(), v.null())),
    viewerLng: v.optional(v.union(v.number(), v.null())),
    radiusKm: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      user_id: v.string(),
      pseudo: v.string(),
      activity_type: v.string(),
      action_text: v.string(),
      xp_earned: v.number(),
      distance_label: v.union(v.string(), v.null()),
      created_at: v.string(),
      is_self: v.boolean(),
      is_ghost_mode_enabled: v.boolean(),
    }),
  ),
  handler: (ctx, args) =>
    getSocialActivityFeed(ctx, {
      sessionToken: args.sessionToken,
      viewerLat: args.viewerLat,
      viewerLng: args.viewerLng,
      radiusKm: args.radiusKm,
      limit: args.limit,
    }),
})

export const getUserStats = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.any(),
  handler: (ctx, args) => getUserStatsForSession(ctx, args.sessionToken),
})

export const reserveAiMealScan = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({
    allowed: v.boolean(),
    scan_count: v.number(),
    daily_limit: v.number(),
  }),
  handler: (ctx, args) => reserveAiMealScanForSession(ctx, args.sessionToken),
})

export const releaseAiMealScan = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await releaseAiMealScanForSession(ctx, args.sessionToken)
    return null
  },
})

export const getAiMealUsageToday = query({
  args: { sessionToken: v.string() },
  returns: v.object({
    scan_count: v.number(),
    daily_limit: v.number(),
  }),
  handler: (ctx, args) => getAiMealUsageTodayForSession(ctx, args.sessionToken),
})
