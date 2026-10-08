/**
 * « Classement de ma salle » — Convex mutations / queries / internal jobs.
 * Ranking recomputed nightly; presence = yes/no + gym + date only (no coords).
 */
import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireSessionUser } from './lib/auth'
import { detectInsultWords, maskInsultWords } from './avisInsults'
import { assertAdultFromStoredProfile } from './avisBeta'
import {
  assertVisitDateAcceptable,
  countPointsFromVisitDateKeys,
  dateKeysInMonth,
  dateKeysInWeek,
  denseRankEntries,
  formatDateKeyUtc,
  GOOGLE_SEARCH_DAILY_LIMIT,
  GYM_CHANGE_COOLDOWN_DAYS,
  googleGymKey,
  isGoogleLocExpired,
  isManualGymKey,
  manualGymKey,
  MIN_GYM_MEMBERS_FOR_RANKING,
  monthKeyFromDateKey,
  type PeriodKind,
  visitDateKeyExpired,
  weekKeyFromDateKey,
} from './gymLeaderboardLogic'

// Re-export pure helpers for tests
export {
  MAX_COUNTED_SESSIONS_PER_WEEK,
  MAX_COUNTED_SESSIONS_PER_DAY,
  MAX_VISIT_AGE_DAYS,
  VISIT_RETENTION_DAYS,
  GOOGLE_LOC_RETENTION_DAYS,
  GOOGLE_SEARCH_DAILY_LIMIT,
  GOOGLE_PLACES_API_KEY_ENV,
  PRESENCE_RADIUS_M,
  PRESENCE_MAX_ACCURACY_M,
  MIN_GYM_MEMBERS_FOR_RANKING,
  assertVisitDateAcceptable,
  countPointsFromVisitDateKeys,
  denseRankEntries,
  groupByRank,
  frenchOrdinalRank,
  decidePresenceOnPhone,
  haversineMeters,
  weekKeyFromDateKey,
  monthKeyFromDateKey,
  formatDateKeyUtc,
  visitDateKeyExpired,
  isGoogleLocExpired,
  googleGymKey,
  manualGymKey,
} from './gymLeaderboardLogic'

export const GYM_PSEUDO_MIN = 2
export const GYM_PSEUDO_MAX = 24
export const GYM_LEADERBOARD_LEAVE_OK = 'left'
export const GYM_VISIT_TOO_OLD = 'VISIT_TOO_OLD'
export const GYM_VISIT_FUTURE = 'VISIT_FUTURE'
export const GYM_VISIT_INVALID = 'VISIT_INVALID'
export const GYM_NOT_MEMBER = 'NOT_MEMBER'
export const GYM_NO_CONSENT = 'NO_LOCATION_CONSENT'
export const GYM_CHANGE_COOLDOWN = 'GYM_CHANGE_COOLDOWN'
export const GYM_PSEUDO_INVALID = 'PSEUDO_INVALID'
export const GYM_MINOR = 'GYM_LEADERBOARD_AGE_REQUIRED'

function todayDateKey(nowMs: number): string {
  return formatDateKeyUtc(new Date(nowMs))
}

function validatePseudo(raw: string): { ok: true; pseudo: string } | { ok: false } {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length < GYM_PSEUDO_MIN || trimmed.length > GYM_PSEUDO_MAX) return { ok: false }
  if (/[<>]/.test(trimmed)) return { ok: false }
  return { ok: true, pseudo: maskInsultWords(trimmed, detectInsultWords(trimmed)) }
}

async function findMembership(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db.query('gym_memberships').withIndex('by_userId', (q) => q.eq('userId', userId)).first()
}

async function findGym(ctx: QueryCtx | MutationCtx, gymKey: string) {
  return ctx.db.query('gym_places').withIndex('by_gymKey', (q) => q.eq('gymKey', gymKey)).first()
}

async function countMembers(ctx: QueryCtx | MutationCtx, gymKey: string): Promise<number> {
  const rows = await ctx.db
    .query('gym_memberships')
    .withIndex('by_gymKey', (q) => q.eq('gymKey', gymKey))
    .collect()
  return rows.length
}

export async function deleteGymLeaderboardDataForUser(
  ctx: MutationCtx,
  userId: string,
  deletedDocIds?: Set<string>,
): Promise<void> {
  const mark = async (id: string) => {
    deletedDocIds?.add(id)
  }

  const memberships = await ctx.db
    .query('gym_memberships')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  for (const row of memberships) {
    await mark(String(row._id))
    await ctx.db.delete(row._id)
  }

  const visits = await ctx.db
    .query('gym_visit_days')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  for (const row of visits) {
    await mark(String(row._id))
    await ctx.db.delete(row._id)
  }

  const snaps = await ctx.db
    .query('gym_leaderboard_snapshots')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  for (const row of snaps) {
    await mark(String(row._id))
    await ctx.db.delete(row._id)
  }

  const searches = await ctx.db
    .query('gym_places_search_daily')
    .withIndex('by_userId_dateKey', (q) => q.eq('userId', userId))
    .collect()
  for (const row of searches) {
    await mark(String(row._id))
    await ctx.db.delete(row._id)
  }

  const reports = await ctx.db
    .query('gym_moderation_reports')
    .withIndex('by_reporter', (q) => q.eq('reporterUserId', userId))
    .collect()
  for (const row of reports) {
    await mark(String(row._id))
    await ctx.db.delete(row._id)
  }
}

export async function leaveGymLeaderboardForSession(
  ctx: MutationCtx,
  args: { sessionToken: string },
): Promise<{ ok: true; status: typeof GYM_LEADERBOARD_LEAVE_OK }> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  await deleteGymLeaderboardDataForUser(ctx, user.userId)
  return { ok: true, status: GYM_LEADERBOARD_LEAVE_OK }
}

export async function joinGymLeaderboardForSession(
  ctx: MutationCtx,
  args: {
    sessionToken: string
    gymKey: string
    pseudo: string
    now?: number
  },
): Promise<
  | { ok: true; gymKey: string; pseudo: string }
  | { ok: false; error: typeof GYM_MINOR | typeof GYM_PSEUDO_INVALID | typeof GYM_CHANGE_COOLDOWN | 'GYM_NOT_FOUND' }
> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const adult = await assertAdultFromStoredProfile(ctx, user.userId)
  if (!adult.ok) return { ok: false, error: GYM_MINOR }

  const pseudoCheck = validatePseudo(args.pseudo)
  if (!pseudoCheck.ok) return { ok: false, error: GYM_PSEUDO_INVALID }

  const gym = await findGym(ctx, args.gymKey)
  if (!gym) return { ok: false, error: 'GYM_NOT_FOUND' }

  const now = args.now ?? Date.now()
  const existing = await findMembership(ctx, user.userId)
  if (existing) {
    if (existing.gymKey !== args.gymKey) {
      const elapsed = now - existing.lastGymChangeAt
      if (elapsed < GYM_CHANGE_COOLDOWN_DAYS * 86_400_000) {
        return { ok: false, error: GYM_CHANGE_COOLDOWN }
      }
      // Changing gym: wipe visits/scores for old membership (points do not follow).
      const oldVisits = await ctx.db
        .query('gym_visit_days')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .collect()
      for (const row of oldVisits) await ctx.db.delete(row._id)
      const oldSnaps = await ctx.db
        .query('gym_leaderboard_snapshots')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .collect()
      for (const row of oldSnaps) await ctx.db.delete(row._id)
      await ctx.db.patch(existing._id, {
        gymKey: args.gymKey,
        pseudo: pseudoCheck.pseudo,
        lastGymChangeAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(existing._id, {
        pseudo: pseudoCheck.pseudo,
        updatedAt: now,
      })
    }
  } else {
    await ctx.db.insert('gym_memberships', {
      userId: user.userId,
      gymKey: args.gymKey,
      pseudo: pseudoCheck.pseudo,
      joinedAt: now,
      lastGymChangeAt: now,
      locationConsent: false,
      createdAt: now,
      updatedAt: now,
    })
  }
  return { ok: true, gymKey: args.gymKey, pseudo: pseudoCheck.pseudo }
}

export async function setLocationConsentForSession(
  ctx: MutationCtx,
  args: { sessionToken: string; consent: boolean; now?: number },
): Promise<{ ok: true; locationConsent: boolean } | { ok: false; error: typeof GYM_NOT_MEMBER }> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const membership = await findMembership(ctx, user.userId)
  if (!membership) return { ok: false, error: GYM_NOT_MEMBER }
  const now = args.now ?? Date.now()
  await ctx.db.patch(membership._id, {
    locationConsent: args.consent,
    locationConsentAt: now,
    updatedAt: now,
  })
  return { ok: true, locationConsent: args.consent }
}

/**
 * Record a validated presence day. Server enforces:
 * - max 1 row per (user, gym, date) — duplicates are no-ops
 * - reject > 7 days late / future
 * - requires membership + locationConsent
 * Coordinates must NEVER be passed here.
 */
export async function recordGymVisitDayForSession(
  ctx: MutationCtx,
  args: {
    sessionToken: string
    gymKey: string
    dateKey: string
    presenceValidated: boolean
    now?: number
  },
): Promise<
  | { ok: true; counted: boolean; duplicate: boolean }
  | {
      ok: false
      error:
        | typeof GYM_NOT_MEMBER
        | typeof GYM_NO_CONSENT
        | typeof GYM_VISIT_TOO_OLD
        | typeof GYM_VISIT_FUTURE
        | typeof GYM_VISIT_INVALID
        | 'PRESENCE_NOT_VALIDATED'
        | 'GYM_MISMATCH'
    }
> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const membership = await findMembership(ctx, user.userId)
  if (!membership) return { ok: false, error: GYM_NOT_MEMBER }
  if (membership.gymKey !== args.gymKey) return { ok: false, error: 'GYM_MISMATCH' }
  if (!membership.locationConsent) return { ok: false, error: GYM_NO_CONSENT }
  if (!args.presenceValidated) return { ok: false, error: 'PRESENCE_NOT_VALIDATED' }

  const now = args.now ?? Date.now()
  const today = todayDateKey(now)
  const gate = assertVisitDateAcceptable(args.dateKey, today)
  if (!gate.ok) {
    if (gate.reason === 'too_old') return { ok: false, error: GYM_VISIT_TOO_OLD }
    if (gate.reason === 'future') return { ok: false, error: GYM_VISIT_FUTURE }
    return { ok: false, error: GYM_VISIT_INVALID }
  }

  const existing = await ctx.db
    .query('gym_visit_days')
    .withIndex('by_userId_gymKey_dateKey', (q) =>
      q.eq('userId', user.userId).eq('gymKey', args.gymKey).eq('dateKey', args.dateKey),
    )
    .first()
  if (existing) {
    return { ok: true, counted: false, duplicate: true }
  }

  await ctx.db.insert('gym_visit_days', {
    userId: user.userId,
    gymKey: args.gymKey,
    dateKey: args.dateKey,
    createdAt: now,
  })
  return { ok: true, counted: true, duplicate: false }
}

export async function createManualGymForSession(
  ctx: MutationCtx,
  args: {
    sessionToken: string
    name: string
    city: string
    now?: number
  },
): Promise<
  | { ok: true; gymKey: string; displayName: string }
  | { ok: false; error: typeof GYM_PSEUDO_INVALID | typeof GYM_MINOR }
> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const adult = await assertAdultFromStoredProfile(ctx, user.userId)
  if (!adult.ok) return { ok: false, error: GYM_MINOR }

  const nameCheck = validatePseudo(args.name)
  const cityTrim = args.city.trim().replace(/\s+/g, ' ')
  if (!nameCheck.ok || cityTrim.length < 2 || cityTrim.length > 64) {
    return { ok: false, error: GYM_PSEUDO_INVALID }
  }

  const now = args.now ?? Date.now()
  const id = `m${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  const gymKey = manualGymKey(id)
  await ctx.db.insert('gym_places', {
    gymKey,
    source: 'manual',
    manualName: nameCheck.pseudo,
    manualCity: cityTrim,
    createdAt: now,
    updatedAt: now,
  })
  return {
    ok: true,
    gymKey,
    displayName: `${nameCheck.pseudo} – ${cityTrim}`,
  }
}

/**
 * Set / refresh gym coordinates from a phone-validated on-site tap for manual gyms,
 * or from a server Place Details refresh for Google (lat/lng only, 30-day TTL).
 * Never accepts user position — only the gym point.
 */
export async function setGymPointForSession(
  ctx: MutationCtx,
  args: {
    sessionToken: string
    gymKey: string
    lat: number
    lng: number
    now?: number
  },
): Promise<{ ok: true } | { ok: false; error: 'GYM_NOT_FOUND' | 'INVALID_COORDS' | typeof GYM_NOT_MEMBER }> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) {
    return { ok: false, error: 'INVALID_COORDS' }
  }
  if (Math.abs(args.lat) > 90 || Math.abs(args.lng) > 180) {
    return { ok: false, error: 'INVALID_COORDS' }
  }
  const gym = await findGym(ctx, args.gymKey)
  if (!gym) return { ok: false, error: 'GYM_NOT_FOUND' }

  // Manual: creator-on-site sets the point once (anyone who joined may set if missing).
  if (isManualGymKey(args.gymKey) && gym.pointSetAt != null) {
    // Keep existing point — do not overwrite after first set.
    return { ok: true }
  }

  const membership = await findMembership(ctx, user.userId)
  if (!membership || membership.gymKey !== args.gymKey) {
    // Google refresh allowed for members only; manual first set same.
    if (!membership) return { ok: false, error: GYM_NOT_MEMBER }
  }

  const now = args.now ?? Date.now()
  await ctx.db.patch(gym._id, {
    lat: args.lat,
    lng: args.lng,
    locFetchedAt: now,
    pointSetAt: isManualGymKey(args.gymKey) ? (gym.pointSetAt ?? now) : gym.pointSetAt,
    updatedAt: now,
  })
  return { ok: true }
}

export async function ensureGoogleGymPlace(
  ctx: MutationCtx,
  args: { placeId: string; lat?: number; lng?: number; now?: number },
): Promise<{ gymKey: string }> {
  const placeId = args.placeId.trim()
  const gymKey = googleGymKey(placeId)
  const existing = await findGym(ctx, gymKey)
  const now = args.now ?? Date.now()
  if (existing) {
    if (
      typeof args.lat === 'number' &&
      typeof args.lng === 'number' &&
      (existing.lat == null || isGoogleLocExpired(existing.locFetchedAt, now))
    ) {
      await ctx.db.patch(existing._id, {
        lat: args.lat,
        lng: args.lng,
        locFetchedAt: now,
        updatedAt: now,
      })
    }
    return { gymKey }
  }
  await ctx.db.insert('gym_places', {
    gymKey,
    source: 'google',
    googlePlaceId: placeId,
    lat: args.lat ?? null,
    lng: args.lng ?? null,
    locFetchedAt: typeof args.lat === 'number' ? now : null,
    createdAt: now,
    updatedAt: now,
  })
  return { gymKey }
}

export async function consumeGoogleSearchQuota(
  ctx: MutationCtx,
  args: { userId: string; dateKey: string; now?: number },
): Promise<{ ok: true; count: number } | { ok: false; count: number; limit: number }> {
  const now = args.now ?? Date.now()
  const row = await ctx.db
    .query('gym_places_search_daily')
    .withIndex('by_userId_dateKey', (q) => q.eq('userId', args.userId).eq('dateKey', args.dateKey))
    .first()
  const count = row?.count ?? 0
  if (count >= GOOGLE_SEARCH_DAILY_LIMIT) {
    return { ok: false, count, limit: GOOGLE_SEARCH_DAILY_LIMIT }
  }
  if (row) {
    await ctx.db.patch(row._id, { count: count + 1, updatedAt: now })
  } else {
    await ctx.db.insert('gym_places_search_daily', {
      userId: args.userId,
      dateKey: args.dateKey,
      count: 1,
      updatedAt: now,
    })
  }
  return { ok: true, count: count + 1 }
}

export async function getMyGymLeaderboardStateForSession(
  ctx: QueryCtx,
  args: { sessionToken: string; now?: number },
) {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const membership = await findMembership(ctx, user.userId)
  if (!membership) {
    return { joined: false as const }
  }
  const gym = await findGym(ctx, membership.gymKey)
  const memberCount = await countMembers(ctx, membership.gymKey)
  const displayName = gym
    ? gym.source === 'manual'
      ? `${gym.manualName ?? 'Ma salle'} – ${gym.manualCity ?? ''}`.trim()
      : null // Google name never cached — client refreshes live
    : null
  const now = args.now ?? Date.now()
  const hasLoc =
    gym?.lat != null &&
    gym?.lng != null &&
    (gym.source === 'manual' || !isGoogleLocExpired(gym.locFetchedAt, now))

  return {
    joined: true as const,
    userId: user.userId,
    gymKey: membership.gymKey,
    pseudo: membership.pseudo,
    locationConsent: membership.locationConsent,
    memberCount,
    rankingVisible: memberCount >= MIN_GYM_MEMBERS_FOR_RANKING,
    gymSource: gym?.source ?? null,
    googlePlaceId: gym?.googlePlaceId ?? null,
    displayName,
    showGoogleAttribution: gym?.source === 'google',
    gymPoint: hasLoc ? { lat: gym!.lat!, lng: gym!.lng! } : null,
  }
}

export async function getGymLeaderboardForSession(
  ctx: QueryCtx,
  args: {
    sessionToken: string
    period: PeriodKind
    periodKey?: string
    now?: number
  },
) {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const membership = await findMembership(ctx, user.userId)
  if (!membership) {
    return { ok: false as const, error: GYM_NOT_MEMBER }
  }
  const memberCount = await countMembers(ctx, membership.gymKey)
  if (memberCount < MIN_GYM_MEMBERS_FOR_RANKING) {
    return {
      ok: true as const,
      rankingVisible: false,
      memberCount,
      entries: [] as Array<{ userId: string; pseudo: string; points: number; rank: number; isMe: boolean }>,
      period: args.period,
      periodKey: args.periodKey ?? '',
      updatedAt: null as number | null,
    }
  }

  const now = args.now ?? Date.now()
  const today = todayDateKey(now)
  const periodKey =
    args.periodKey ??
    (args.period === 'week' ? weekKeyFromDateKey(today) : monthKeyFromDateKey(today))

  const snaps = await ctx.db
    .query('gym_leaderboard_snapshots')
    .withIndex('by_gym_period', (q) =>
      q.eq('gymKey', membership.gymKey).eq('period', args.period).eq('periodKey', periodKey),
    )
    .collect()

  const ranked = denseRankEntries(
    snaps.map((s) => ({ userId: s.userId, pseudo: s.pseudo, points: s.points })),
  )
  const entries = ranked.map((e) => ({
    ...e,
    isMe: e.userId === user.userId,
  }))
  const computedAt = snaps.reduce<number | null>(
    (max, s) => (max == null || s.computedAt > max ? s.computedAt : max),
    null,
  )

  return {
    ok: true as const,
    rankingVisible: true,
    memberCount,
    entries,
    period: args.period,
    periodKey,
    updatedAt: computedAt,
  }
}

/**
 * Recompute snapshots for one gym + period from visit_days.
 * Points: 1/day max, 2/week max — never load/volume/time.
 */
export async function recomputeGymPeriodScores(
  ctx: MutationCtx,
  args: {
    gymKey: string
    period: PeriodKind
    periodKey: string
    now?: number
  },
): Promise<{ members: number; written: number }> {
  const now = args.now ?? Date.now()
  const { start, end } =
    args.period === 'week' ? dateKeysInWeek(args.periodKey) : dateKeysInMonth(args.periodKey)

  const memberships = await ctx.db
    .query('gym_memberships')
    .withIndex('by_gymKey', (q) => q.eq('gymKey', args.gymKey))
    .collect()

  // Clear previous snapshots for this period
  const old = await ctx.db
    .query('gym_leaderboard_snapshots')
    .withIndex('by_gym_period', (q) =>
      q.eq('gymKey', args.gymKey).eq('period', args.period).eq('periodKey', args.periodKey),
    )
    .collect()
  for (const row of old) await ctx.db.delete(row._id)

  let written = 0
  for (const m of memberships) {
    const visits = await ctx.db
      .query('gym_visit_days')
      .withIndex('by_userId', (q) => q.eq('userId', m.userId))
      .collect()
    const dateKeys = visits
      .filter((v) => v.gymKey === args.gymKey && v.dateKey >= start && v.dateKey <= end)
      .map((v) => v.dateKey)
    const points = countPointsFromVisitDateKeys(dateKeys)
    await ctx.db.insert('gym_leaderboard_snapshots', {
      gymKey: args.gymKey,
      period: args.period,
      periodKey: args.periodKey,
      userId: m.userId,
      pseudo: m.pseudo,
      points,
      computedAt: now,
    })
    written += 1
  }
  return { members: memberships.length, written }
}

export async function recomputeAllGymLeaderboards(
  ctx: MutationCtx,
  args?: { now?: number },
): Promise<{ gyms: number }> {
  const now = args?.now ?? Date.now()
  const today = todayDateKey(now)
  const weekKey = weekKeyFromDateKey(today)
  const monthKey = monthKeyFromDateKey(today)

  const memberships = await ctx.db.query('gym_memberships').collect()
  const gymKeys = [...new Set(memberships.map((m) => m.gymKey))]
  for (const gymKey of gymKeys) {
    await recomputeGymPeriodScores(ctx, { gymKey, period: 'week', periodKey: weekKey, now })
    await recomputeGymPeriodScores(ctx, { gymKey, period: 'month', periodKey: monthKey, now })
  }
  return { gyms: gymKeys.length }
}

export async function purgeExpiredGymVisitDays(
  ctx: MutationCtx,
  args?: { now?: number; limit?: number },
): Promise<{ deleted: number }> {
  const now = args?.now ?? Date.now()
  const today = todayDateKey(now)
  const limit = args?.limit ?? 500
  const all = await ctx.db.query('gym_visit_days').collect()
  let deleted = 0
  for (const row of all) {
    if (deleted >= limit) break
    if (visitDateKeyExpired(row.dateKey, today)) {
      await ctx.db.delete(row._id)
      deleted += 1
    }
  }
  return { deleted }
}

export async function purgeExpiredGoogleGymLocations(
  ctx: MutationCtx,
  args?: { now?: number; limit?: number },
): Promise<{ cleared: number }> {
  const now = args?.now ?? Date.now()
  const limit = args?.limit ?? 500
  const places = await ctx.db.query('gym_places').collect()
  let cleared = 0
  for (const place of places) {
    if (cleared >= limit) break
    if (place.source !== 'google') continue
    if (place.lat == null && place.lng == null) continue
    if (!isGoogleLocExpired(place.locFetchedAt, now)) continue
    await ctx.db.patch(place._id, {
      lat: null,
      lng: null,
      locFetchedAt: null,
      updatedAt: now,
    })
    cleared += 1
  }
  return { cleared }
}

export async function reportGymContentForSession(
  ctx: MutationCtx,
  args: {
    sessionToken: string
    targetKind: 'pseudo' | 'manual_gym'
    targetKey: string
    now?: number
  },
): Promise<{ ok: true }> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  const now = args.now ?? Date.now()
  await ctx.db.insert('gym_moderation_reports', {
    reporterUserId: user.userId,
    targetKind: args.targetKind,
    targetKey: args.targetKey.trim().slice(0, 128),
    createdAt: now,
  })
  return { ok: true }
}

// —— Convex public / internal wrappers ——

export const getMyState = query({
  args: { sessionToken: v.string() },
  handler: (ctx, args) => getMyGymLeaderboardStateForSession(ctx, args),
})

export const getLeaderboard = query({
  args: {
    sessionToken: v.string(),
    period: v.union(v.literal('week'), v.literal('month')),
    periodKey: v.optional(v.string()),
  },
  handler: (ctx, args) => getGymLeaderboardForSession(ctx, args),
})

export const join = mutation({
  args: {
    sessionToken: v.string(),
    gymKey: v.string(),
    pseudo: v.string(),
  },
  handler: (ctx, args) => joinGymLeaderboardForSession(ctx, args),
})

export const leave = mutation({
  args: { sessionToken: v.string() },
  handler: (ctx, args) => leaveGymLeaderboardForSession(ctx, args),
})

export const setLocationConsent = mutation({
  args: { sessionToken: v.string(), consent: v.boolean() },
  handler: (ctx, args) => setLocationConsentForSession(ctx, args),
})

export const recordVisitDay = mutation({
  args: {
    sessionToken: v.string(),
    gymKey: v.string(),
    dateKey: v.string(),
    presenceValidated: v.boolean(),
  },
  handler: (ctx, args) => recordGymVisitDayForSession(ctx, args),
})

export const createManualGym = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    city: v.string(),
  },
  handler: (ctx, args) => createManualGymForSession(ctx, args),
})

export const setGymPoint = mutation({
  args: {
    sessionToken: v.string(),
    gymKey: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: (ctx, args) => setGymPointForSession(ctx, args),
})

export const reportContent = mutation({
  args: {
    sessionToken: v.string(),
    targetKind: v.union(v.literal('pseudo'), v.literal('manual_gym')),
    targetKey: v.string(),
  },
  handler: (ctx, args) => reportGymContentForSession(ctx, args),
})

export const ensureGoogleGym = internalMutation({
  args: {
    placeId: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: (ctx, args) => ensureGoogleGymPlace(ctx, args),
})

export const consumeSearchQuota = internalMutation({
  args: { userId: v.string(), dateKey: v.string() },
  handler: (ctx, args) => consumeGoogleSearchQuota(ctx, args),
})

export const recomputeAllNightly = internalMutation({
  args: {},
  handler: (ctx) => recomputeAllGymLeaderboards(ctx),
})

export const purgeExpiredVisits = internalMutation({
  args: {},
  handler: (ctx) => purgeExpiredGymVisitDays(ctx),
})

export const purgeExpiredGoogleLocs = internalMutation({
  args: {},
  handler: (ctx) => purgeExpiredGoogleGymLocations(ctx),
})

/** Test / migration helper refs (scheduler-safe). */
export const recomputeAllNightlyRef = makeFunctionReference<'mutation'>(
  'gymLeaderboard:recomputeAllNightly',
)
export const purgeExpiredVisitsRef = makeFunctionReference<'mutation'>(
  'gymLeaderboard:purgeExpiredVisits',
)
export const purgeExpiredGoogleLocsRef = makeFunctionReference<'mutation'>(
  'gymLeaderboard:purgeExpiredGoogleLocs',
)
