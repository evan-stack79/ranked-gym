/**
 * Ranked Force / Ranked Discipline — Convex API P0 (ARCHI §5).
 * Cosmétique Bronze→Légende inchangé. Pas de bodyweight / IAP / look.
 */
import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireSessionUser } from './lib/auth'
import {
  assertRankedCompetitiveAccess,
  RANKED_DISCIPLINE_DISABLED,
  RANKED_FORCE_DISABLED,
  RANKED_NOT_OPTED_IN,
} from './lib/rankedAccess'
import {
  CYCLE_LENGTH_MS,
  DISCIPLINE_STREAK_MIN_SESSIONS,
  disciplinePointsForNewSession,
  disciplineScore,
  disciplineSessionPoints,
  emptyForceBreakdown,
  evaluateSubmitLift,
  forceScoreFromBreakdown,
  isRankedForceExercise,
  leagueTierForScore,
  publicRankedMethod,
  RANKED_FORCE_EXERCISES,
  RANKED_LEAGUE_TIERS,
  SELF_VERIFY_DELAY_MS,
  type ForceBreakdown,
  type RankedSex,
} from './lib/rankedScience'
import { findProfileByUserId } from './lib/socialVisibility'

type SessionCtx = QueryCtx | MutationCtx

const MS_DAY = 24 * 60 * 60 * 1000
const MS_WEEK = 7 * MS_DAY

function orderedPair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a }
}

async function getOptIn(ctx: SessionCtx, userId: string) {
  return ctx.db
    .query('rankedOptIn')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function requireForceOptIn(ctx: SessionCtx, userId: string) {
  const opt = await getOptIn(ctx, userId)
  if (!opt || opt.optedOutAt) {
    return { ok: false as const, error: RANKED_NOT_OPTED_IN }
  }
  if (!opt.forceEnabled) {
    return { ok: false as const, error: RANKED_FORCE_DISABLED }
  }
  return { ok: true as const, opt }
}

async function requireDisciplineOptIn(ctx: SessionCtx, userId: string) {
  const opt = await getOptIn(ctx, userId)
  if (!opt || opt.optedOutAt) {
    return { ok: false as const, error: RANKED_NOT_OPTED_IN }
  }
  if (!opt.disciplineEnabled) {
    return { ok: false as const, error: RANKED_DISCIPLINE_DISABLED }
  }
  return { ok: true as const, opt }
}

async function ensureActiveCycle(ctx: MutationCtx, now: number): Promise<Doc<'rankedCycle'>> {
  const active = await ctx.db
    .query('rankedCycle')
    .withIndex('by_status', (q) => q.eq('status', 'active'))
    .first()
  if (active && active.endsAt > now) return active

  if (active && active.endsAt <= now) {
    await ctx.db.patch(active._id, { status: 'closing' })
  }

  const cycleId = await ctx.db.insert('rankedCycle', {
    startsAt: now,
    endsAt: now + CYCLE_LENGTH_MS,
    status: 'active',
  })

  for (const league of RANKED_LEAGUE_TIERS) {
    await ctx.db.insert('rankedLeague', {
      cycleId,
      name: league.name,
      tier: league.tier,
      minScore: league.minScore,
      maxScore: Number.isFinite(league.maxScore) ? league.maxScore : 1_000_000_000,
    })
  }

  const created = await ctx.db.get(cycleId)
  if (!created) throw new Error('RANKED_CYCLE_CREATE_FAILED')
  return created
}

async function getActiveCycle(ctx: SessionCtx): Promise<Doc<'rankedCycle'> | null> {
  return ctx.db
    .query('rankedCycle')
    .withIndex('by_status', (q) => q.eq('status', 'active'))
    .first()
}

async function leagueForScore(
  ctx: MutationCtx,
  cycleId: Id<'rankedCycle'>,
  score: number,
): Promise<Doc<'rankedLeague'>> {
  const leagues = await ctx.db
    .query('rankedLeague')
    .withIndex('by_cycleId', (q) => q.eq('cycleId', cycleId))
    .collect()
  const sorted = leagues.sort((a, b) => a.tier - b.tier)
  const tierMeta = leagueTierForScore(score)
  const match =
    sorted.find((l) => l.tier === tierMeta.tier) ??
    sorted.find((l) => score >= l.minScore && score <= l.maxScore) ??
    sorted[0]
  if (!match) throw new Error('RANKED_LEAGUE_MISSING')
  return match
}

async function getVerifiedPrs(
  ctx: SessionCtx,
  userId: string,
): Promise<Map<string, Doc<'rankedVerifiedPr'>>> {
  const rows = await ctx.db
    .query('rankedVerifiedPr')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  const map = new Map<string, Doc<'rankedVerifiedPr'>>()
  for (const row of rows) map.set(row.canonicalExerciseId, row)
  return map
}

async function recalcForceScoreInternal(
  ctx: MutationCtx,
  userId: string,
  now = Date.now(),
): Promise<{ score: number; breakdown: ForceBreakdown; leagueId: Id<'rankedLeague'> }> {
  const cycle = await ensureActiveCycle(ctx, now)
  const prs = await getVerifiedPrs(ctx, userId)
  const breakdown = emptyForceBreakdown()
  for (const id of RANKED_FORCE_EXERCISES) {
    const pr = prs.get(id)
    breakdown[id] = pr?.estimated1RmKg ?? 0
  }
  const score = forceScoreFromBreakdown(breakdown)
  const league = await leagueForScore(ctx, cycle._id, score)

  const existing = await ctx.db
    .query('rankedForceScore')
    .withIndex('by_user_cycle', (q) => q.eq('userId', userId).eq('cycleId', cycle._id))
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      score,
      breakdown,
      leagueId: league._id,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert('rankedForceScore', {
      userId,
      cycleId: cycle._id,
      score,
      breakdown,
      leagueId: league._id,
      updatedAt: now,
    })
  }

  return { score, breakdown, leagueId: league._id }
}

async function markVerifiedAndScore(
  ctx: MutationCtx,
  lift: Doc<'rankedLiftLog'>,
  method: 'self_24h' | 'friend_18' | 'review',
  now: number,
) {
  if (lift.estimated1RmKg == null || !isRankedForceExercise(lift.canonicalExerciseId)) {
    throw new Error('RANKED_LIFT_NOT_FORCE_ELIGIBLE')
  }
  const cycle = await ensureActiveCycle(ctx, now)
  await ctx.db.patch(lift._id, {
    status: 'verified',
    verifiedAt: now,
    verifyMethod: method,
  })

  const existing = await ctx.db
    .query('rankedVerifiedPr')
    .withIndex('by_user_exercise', (q) =>
      q.eq('userId', lift.userId).eq('canonicalExerciseId', lift.canonicalExerciseId),
    )
    .first()

  if (!existing || lift.estimated1RmKg > existing.estimated1RmKg) {
    if (existing) {
      await ctx.db.patch(existing._id, {
        estimated1RmKg: lift.estimated1RmKg,
        liftLogId: lift._id,
        verifiedAt: now,
        cycleId: cycle._id,
      })
    } else {
      await ctx.db.insert('rankedVerifiedPr', {
        userId: lift.userId,
        canonicalExerciseId: lift.canonicalExerciseId,
        estimated1RmKg: lift.estimated1RmKg,
        liftLogId: lift._id,
        verifiedAt: now,
        cycleId: cycle._id,
      })
    }
  }

  await recalcForceScoreInternal(ctx, lift.userId, now)
}

function weekStartMs(ts: number): number {
  const d = new Date(ts)
  // Monday-based ISO-ish week in UTC for deterministic server streak.
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff)
  return start
}

async function computeDisciplineFromSessions(
  ctx: SessionCtx,
  userId: string,
  now: number,
  pauseInjuryUntil?: number,
): Promise<{ sessionsLast7d: number; streakWeeks: number; score: number; paused: boolean }> {
  const paused = pauseInjuryUntil != null && pauseInjuryUntil > now
  if (paused) {
    const existing = await ctx.db
      .query('rankedDisciplineScore')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    return {
      sessionsLast7d: existing?.sessionsLast7d ?? 0,
      streakWeeks: existing?.streakWeeks ?? 0,
      score: existing?.score ?? 0,
      paused: true,
    }
  }

  const windowStart = now - 7 * MS_DAY
  const recent = await ctx.db
    .query('rankedSessionCompletion')
    .withIndex('by_user_time', (q) => q.eq('userId', userId).gte('completedAt', windowStart))
    .collect()
  const sessionsLast7d = disciplineSessionPoints(recent.length)

  // Streak: consecutive weeks (ending current) with ≥ N sessions. Rest days OK.
  const all = await ctx.db
    .query('rankedSessionCompletion')
    .withIndex('by_user_time', (q) => q.eq('userId', userId))
    .collect()

  const byWeek = new Map<number, number>()
  for (const row of all) {
    const w = weekStartMs(row.completedAt)
    byWeek.set(w, (byWeek.get(w) ?? 0) + 1)
  }

  let streakWeeks = 0
  let cursor = weekStartMs(now)
  while (true) {
    const count = byWeek.get(cursor) ?? 0
    if (count >= DISCIPLINE_STREAK_MIN_SESSIONS) {
      streakWeeks += 1
      cursor -= MS_WEEK
    } else {
      break
    }
  }

  return {
    sessionsLast7d,
    streakWeeks,
    score: disciplineScore(sessionsLast7d, streakWeeks),
    paused: false,
  }
}

async function upsertDisciplineScore(
  ctx: MutationCtx,
  userId: string,
  now: number,
  pauseInjuryUntil?: number,
) {
  const cycle = await ensureActiveCycle(ctx, now)
  const computed = await computeDisciplineFromSessions(ctx, userId, now, pauseInjuryUntil)
  if (computed.paused) return computed

  const existing = await ctx.db
    .query('rankedDisciplineScore')
    .withIndex('by_user_cycle', (q) => q.eq('userId', userId).eq('cycleId', cycle._id))
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      sessionsLast7d: computed.sessionsLast7d,
      streakWeeks: computed.streakWeeks,
      score: computed.score,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert('rankedDisciplineScore', {
      userId,
      cycleId: cycle._id,
      sessionsLast7d: computed.sessionsLast7d,
      streakWeeks: computed.streakWeeks,
      score: computed.score,
      updatedAt: now,
    })
  }
  return computed
}

async function areAcceptedFriends(ctx: SessionCtx, a: string, b: string): Promise<boolean> {
  const { userA, userB } = orderedPair(a, b)
  const row = await ctx.db
    .query('rankedFriendship')
    .withIndex('by_pair', (q) => q.eq('userA', userA).eq('userB', userB))
    .first()
  return Boolean(row && row.status === 'accepted')
}

async function listAcceptedFriendIds(ctx: SessionCtx, userId: string): Promise<string[]> {
  const asA = await ctx.db
    .query('rankedFriendship')
    .withIndex('by_userA_status', (q) => q.eq('userA', userId).eq('status', 'accepted'))
    .collect()
  const asB = await ctx.db
    .query('rankedFriendship')
    .withIndex('by_userB_status', (q) => q.eq('userB', userId).eq('status', 'accepted'))
    .collect()
  const ids = new Set<string>()
  for (const row of asA) ids.add(row.userB)
  for (const row of asB) ids.add(row.userA)
  return [...ids]
}

async function publicAvatarUrl(
  ctx: SessionCtx,
  profile: Doc<'profiles'> | null,
): Promise<string | null> {
  if (!profile?.avatarFileId) return null
  const file = await ctx.db.get(profile.avatarFileId)
  if (!file) return null
  return (await ctx.storage.getUrl(file.storageId)) ?? null
}

// ─── Public method (CA5) ─────────────────────────────────────────────────────

export const getPublicMethod = query({
  args: {},
  handler: async () => publicRankedMethod(),
})

// ─── Opt-in / status ─────────────────────────────────────────────────────────

export const setOptIn = mutation({
  args: {
    sessionToken: v.string(),
    forceEnabled: v.boolean(),
    disciplineEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) {
      return { ok: false as const, error: gate.error }
    }

    const now = Date.now()
    const existing = await getOptIn(ctx, user.userId)
    const enabling = args.forceEnabled || args.disciplineEnabled

    if (!enabling) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          forceEnabled: false,
          disciplineEnabled: false,
          optedOutAt: now,
        })
      }
      return {
        ok: true as const,
        forceEnabled: false,
        disciplineEnabled: false,
        optedOut: true,
      }
    }

    await ensureActiveCycle(ctx, now)

    if (existing) {
      await ctx.db.patch(existing._id, {
        forceEnabled: args.forceEnabled,
        disciplineEnabled: args.disciplineEnabled,
        optedInAt: existing.optedOutAt ? now : existing.optedInAt,
        optedOutAt: undefined,
        ageGatePassedAt: now,
        sex: gate.sex,
      })
    } else {
      await ctx.db.insert('rankedOptIn', {
        userId: user.userId,
        forceEnabled: args.forceEnabled,
        disciplineEnabled: args.disciplineEnabled,
        optedInAt: now,
        ageGatePassedAt: now,
        sex: gate.sex,
      })
    }

    if (args.forceEnabled) {
      await recalcForceScoreInternal(ctx, user.userId, now)
    }
    if (args.disciplineEnabled) {
      await upsertDisciplineScore(ctx, user.userId, now)
    }

    return {
      ok: true as const,
      forceEnabled: args.forceEnabled,
      disciplineEnabled: args.disciplineEnabled,
      optedOut: false,
      sex: gate.sex,
    }
  },
})

export const getMyStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const opt = await getOptIn(ctx, user.userId)
    const cycle = await getActiveCycle(ctx)
    const force = cycle
      ? await ctx.db
          .query('rankedForceScore')
          .withIndex('by_user_cycle', (q) =>
            q.eq('userId', user.userId).eq('cycleId', cycle._id),
          )
          .first()
      : null
    const discipline = cycle
      ? await ctx.db
          .query('rankedDisciplineScore')
          .withIndex('by_user_cycle', (q) =>
            q.eq('userId', user.userId).eq('cycleId', cycle._id),
          )
          .first()
      : null
    const league = force ? await ctx.db.get(force.leagueId) : null
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)

    return {
      eligible: gate.ok,
      eligibilityError: gate.ok ? null : gate.error,
      optIn: opt
        ? {
            forceEnabled: opt.forceEnabled && !opt.optedOutAt,
            disciplineEnabled: opt.disciplineEnabled && !opt.optedOutAt,
            sex: opt.sex,
            pauseInjuryUntil: opt.pauseInjuryUntil ?? null,
            optedInAt: opt.optedInAt,
            optedOutAt: opt.optedOutAt ?? null,
          }
        : null,
      cycle: cycle
        ? {
            id: cycle._id,
            startsAt: cycle.startsAt,
            endsAt: cycle.endsAt,
            status: cycle.status,
          }
        : null,
      force: force
        ? {
            score: force.score,
            breakdown: force.breakdown,
            league: league
              ? { id: league._id, name: league.name, tier: league.tier }
              : null,
          }
        : null,
      discipline: discipline
        ? {
            sessionsLast7d: discipline.sessionsLast7d,
            streakWeeks: discipline.streakWeeks,
            score: discipline.score,
          }
        : null,
      gymLeaderboard: 'P0-bis — hors scope premier livrable',
    }
  },
})

// ─── Lifts / verify ──────────────────────────────────────────────────────────

export const submitLift = mutation({
  args: {
    sessionToken: v.string(),
    canonicalExerciseId: v.string(),
    weightKg: v.number(),
    reps: v.number(),
    sourceSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }

    const forceGate = await requireForceOptIn(ctx, user.userId)
    // Carnet Déclaré toujours possible si opt-in Force OU simple log ; SPEC: Déclaré = carnet.
    // Pour P0 on exige opt-in Force pour submitLift compétitif ; sinon declared-only path still allowed if opted in either.
    const opt = await getOptIn(ctx, user.userId)
    if (!opt || opt.optedOutAt || (!opt.forceEnabled && !opt.disciplineEnabled)) {
      return { ok: false as const, error: RANKED_NOT_OPTED_IN }
    }

    const now = Date.now()
    const sex: RankedSex = opt.sex ?? gate.sex
    const prs = await getVerifiedPrs(ctx, user.userId)
    const verifiedRefs = {
      deadlift: prs.get('deadlift')?.estimated1RmKg,
      bench: prs.get('bench')?.estimated1RmKg,
    }

    const history = await ctx.db
      .query('rankedLiftLog')
      .withIndex('by_user_exercise_time', (q) =>
        q.eq('userId', user.userId).eq('canonicalExerciseId', args.canonicalExerciseId),
      )
      .collect()
    const sorted = history.sort((a, b) => b.createdAt - a.createdAt)
    const previous = sorted.find((r) => r.estimated1RmKg != null) ?? null
    const first = history.length
      ? history.reduce((min, r) => (r.createdAt < min.createdAt ? r : min))
      : null

    const evaluation = evaluateSubmitLift({
      canonicalExerciseId: args.canonicalExerciseId,
      weightKg: args.weightKg,
      reps: args.reps,
      sex,
      verifiedRefs,
      previous1RmKg: previous?.estimated1RmKg ?? null,
      previousAtMs: previous?.createdAt ?? null,
      historyFirstAtMs: first?.createdAt ?? null,
      nowMs: now,
    })

    // If Force disabled, force declared-only (carnet).
    let status = evaluation.status
    if (!forceGate.ok && status !== 'declared') {
      status = 'declared'
    }

    const liftLogId = await ctx.db.insert('rankedLiftLog', {
      userId: user.userId,
      canonicalExerciseId: args.canonicalExerciseId,
      weightKg: args.weightKg,
      reps: args.reps,
      estimated1RmKg: evaluation.estimated1RmKg ?? undefined,
      status,
      anomalyFlag: evaluation.anomalyFlag,
      sourceSessionId: args.sourceSessionId,
      createdAt: now,
      needsReviewQueue: evaluation.needsReviewQueue,
      rejectReason: evaluation.reason,
    })

    return {
      ok: true as const,
      liftLogId,
      status,
      estimated1RmKg: evaluation.estimated1RmKg,
      anomalyFlag: evaluation.anomalyFlag,
      needsReviewQueue: evaluation.needsReviewQueue,
      reason: evaluation.reason ?? null,
      label:
        evaluation.estimated1RmKg != null && args.reps >= 2 && args.reps <= 10
          ? '1RM estimé'
          : args.reps === 1
            ? '1RM'
            : null,
    }
  },
})

export const listMyLifts = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const limit = Math.min(100, Math.max(1, args.limit ?? 40))
    const rows = await ctx.db
      .query('rankedLiftLog')
      .withIndex('by_userId', (q) => q.eq('userId', user.userId))
      .collect()
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((r) => ({
        id: r._id,
        canonicalExerciseId: r.canonicalExerciseId,
        weightKg: r.weightKg,
        reps: r.reps,
        estimated1RmKg: r.estimated1RmKg ?? null,
        status: r.status,
        anomalyFlag: r.anomalyFlag,
        createdAt: r.createdAt,
        verifiedAt: r.verifiedAt ?? null,
        rejectReason: r.rejectReason ?? null,
        needsReviewQueue: r.needsReviewQueue ?? false,
      }))
  },
})

export const listMyVerifiedPrs = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const prs = await getVerifiedPrs(ctx, user.userId)
    return RANKED_FORCE_EXERCISES.map((id) => {
      const pr = prs.get(id)
      return {
        canonicalExerciseId: id,
        estimated1RmKg: pr?.estimated1RmKg ?? null,
        verifiedAt: pr?.verifiedAt ?? null,
        liftLogId: pr?.liftLogId ?? null,
      }
    })
  },
})

export const requestVerify = mutation({
  args: {
    sessionToken: v.string(),
    liftLogId: v.id('rankedLiftLog'),
    method: v.union(v.literal('self_24h'), v.literal('friend_18')),
    friendId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const forceGate = await requireForceOptIn(ctx, user.userId)
    if (!forceGate.ok) return { ok: false as const, error: forceGate.error }

    const lift = await ctx.db.get(args.liftLogId)
    if (!lift || lift.userId !== user.userId) {
      return { ok: false as const, error: 'RANKED_LIFT_NOT_FOUND' as const }
    }
    if (lift.status !== 'pending_verify') {
      return { ok: false as const, error: 'RANKED_LIFT_NOT_PENDING' as const }
    }

    if (args.method === 'friend_18') {
      if (!args.friendId) {
        return { ok: false as const, error: 'RANKED_FRIEND_REQUIRED' as const }
      }
      if (!(await areAcceptedFriends(ctx, user.userId, args.friendId))) {
        return { ok: false as const, error: 'RANKED_NOT_FRIENDS' as const }
      }
      const friendGate = await assertRankedCompetitiveAccess(ctx, args.friendId)
      if (!friendGate.ok) {
        return { ok: false as const, error: 'RANKED_FRIEND_NOT_ELIGIBLE' as const }
      }
      const friendOpt = await requireForceOptIn(ctx, args.friendId)
      if (!friendOpt.ok) {
        return { ok: false as const, error: 'RANKED_FRIEND_NOT_OPTED_IN' as const }
      }
    }

    const now = Date.now()
    const expiresAt =
      args.method === 'self_24h' ? lift.createdAt + SELF_VERIFY_DELAY_MS : now + 7 * MS_DAY

    const requestId = await ctx.db.insert('rankedVerifyRequest', {
      liftLogId: lift._id,
      ownerId: user.userId,
      method: args.method,
      friendId: args.method === 'friend_18' ? args.friendId : undefined,
      createdAt: now,
      expiresAt,
      status: 'open',
    })

    return { ok: true as const, requestId, expiresAt }
  },
})

export const confirmVerifySelf = mutation({
  args: {
    sessionToken: v.string(),
    liftLogId: v.id('rankedLiftLog'),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const forceGate = await requireForceOptIn(ctx, user.userId)
    if (!forceGate.ok) return { ok: false as const, error: forceGate.error }

    const lift = await ctx.db.get(args.liftLogId)
    if (!lift || lift.userId !== user.userId) {
      return { ok: false as const, error: 'RANKED_LIFT_NOT_FOUND' as const }
    }
    if (lift.status !== 'pending_verify') {
      return { ok: false as const, error: 'RANKED_LIFT_NOT_PENDING' as const }
    }

    const now = Date.now()
    if (now < lift.createdAt + SELF_VERIFY_DELAY_MS) {
      return {
        ok: false as const,
        error: 'RANKED_SELF_VERIFY_TOO_EARLY' as const,
        availableAt: lift.createdAt + SELF_VERIFY_DELAY_MS,
      }
    }

    const openReq = await ctx.db
      .query('rankedVerifyRequest')
      .withIndex('by_liftLogId', (q) => q.eq('liftLogId', lift._id))
      .collect()
    const selfReq = openReq.find((r) => r.method === 'self_24h' && r.status === 'open')
    if (selfReq) {
      await ctx.db.patch(selfReq._id, { status: 'confirmed' })
    }

    await markVerifiedAndScore(ctx, lift, 'self_24h', now)
    return { ok: true as const, status: 'verified' as const }
  },
})

export const confirmVerifyFriend = mutation({
  args: {
    sessionToken: v.string(),
    requestId: v.id('rankedVerifyRequest'),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const friend = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, friend.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const forceGate = await requireForceOptIn(ctx, friend.userId)
    if (!forceGate.ok) return { ok: false as const, error: forceGate.error }

    const req = await ctx.db.get(args.requestId)
    if (!req || req.method !== 'friend_18' || req.friendId !== friend.userId) {
      return { ok: false as const, error: 'RANKED_VERIFY_REQUEST_NOT_FOUND' as const }
    }
    if (req.status !== 'open') {
      return { ok: false as const, error: 'RANKED_VERIFY_REQUEST_CLOSED' as const }
    }
    const now = Date.now()
    if (now > req.expiresAt) {
      await ctx.db.patch(req._id, { status: 'expired' })
      return { ok: false as const, error: 'RANKED_VERIFY_EXPIRED' as const }
    }
    if (!args.accept) {
      await ctx.db.patch(req._id, { status: 'denied' })
      return { ok: true as const, status: 'denied' as const }
    }

    const lift = await ctx.db.get(req.liftLogId)
    if (!lift || lift.status !== 'pending_verify') {
      return { ok: false as const, error: 'RANKED_LIFT_NOT_PENDING' as const }
    }

    await ctx.db.patch(req._id, { status: 'confirmed' })
    await markVerifiedAndScore(ctx, lift, 'friend_18', now)
    return { ok: true as const, status: 'verified' as const }
  },
})

/** Internal recalc — also exposed as mutation for admin/tests via session. */
export const recalcForceScore = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const forceGate = await requireForceOptIn(ctx, user.userId)
    if (!forceGate.ok) return { ok: false as const, error: forceGate.error }
    const result = await recalcForceScoreInternal(ctx, user.userId)
    return { ok: true as const, ...result }
  },
})

export const recalcForceScoreInternalMutation = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => recalcForceScoreInternal(ctx, args.userId),
})

// ─── Discipline ──────────────────────────────────────────────────────────────

export const onSessionCompleted = mutation({
  args: {
    sessionToken: v.string(),
    sourceSessionId: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const discGate = await requireDisciplineOptIn(ctx, user.userId)
    if (!discGate.ok) return { ok: false as const, error: discGate.error }

    const now = args.completedAt ?? Date.now()
    const opt = discGate.opt
    if (opt.pauseInjuryUntil != null && opt.pauseInjuryUntil > now) {
      return {
        ok: true as const,
        pointsAdded: 0,
        paused: true,
        sessionsLast7d: 0,
        streakWeeks: 0,
        score: 0,
      }
    }

    const windowStart = now - 7 * MS_DAY
    const recent = await ctx.db
      .query('rankedSessionCompletion')
      .withIndex('by_user_time', (q) => q.eq('userId', user.userId).gte('completedAt', windowStart))
      .collect()
    const pointsAdded = disciplinePointsForNewSession(recent.length)

    await ctx.db.insert('rankedSessionCompletion', {
      userId: user.userId,
      completedAt: now,
      sourceSessionId: args.sourceSessionId,
    })

    // Even if pointsAdded=0 (6th+), still record session for history; score stays capped.
    void pointsAdded
    const computed = await upsertDisciplineScore(ctx, user.userId, now, opt.pauseInjuryUntil)
    return {
      ok: true as const,
      pointsAdded,
      paused: false,
      sessionsLast7d: computed.sessionsLast7d,
      streakWeeks: computed.streakWeeks,
      score: computed.score,
    }
  },
})

export const setInjuryPause = mutation({
  args: {
    sessionToken: v.string(),
    untilMs: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const opt = await getOptIn(ctx, user.userId)
    if (!opt || opt.optedOutAt) {
      return { ok: false as const, error: RANKED_NOT_OPTED_IN }
    }
    await ctx.db.patch(opt._id, {
      pauseInjuryUntil: args.untilMs == null ? undefined : args.untilMs,
    })
    return { ok: true as const, pauseInjuryUntil: args.untilMs }
  },
})

// ─── Friends + leaderboard (CA8) ─────────────────────────────────────────────

export const requestFriendship = mutation({
  args: {
    sessionToken: v.string(),
    friendUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (user.userId === args.friendUserId) {
      return { ok: false as const, error: 'RANKED_FRIEND_SELF' as const }
    }
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const opt = await getOptIn(ctx, user.userId)
    if (!opt || opt.optedOutAt) {
      return { ok: false as const, error: RANKED_NOT_OPTED_IN }
    }

    const { userA, userB } = orderedPair(user.userId, args.friendUserId)
    const existing = await ctx.db
      .query('rankedFriendship')
      .withIndex('by_pair', (q) => q.eq('userA', userA).eq('userB', userB))
      .first()
    const now = Date.now()
    if (existing) {
      if (existing.status === 'accepted') {
        return { ok: true as const, status: 'accepted' as const }
      }
      return { ok: true as const, status: 'pending' as const, friendshipId: existing._id }
    }
    const friendshipId = await ctx.db.insert('rankedFriendship', {
      userA,
      userB,
      status: 'pending',
      requestedBy: user.userId,
      createdAt: now,
      updatedAt: now,
    })
    return { ok: true as const, status: 'pending' as const, friendshipId }
  },
})

export const respondFriendship = mutation({
  args: {
    sessionToken: v.string(),
    friendshipId: v.id('rankedFriendship'),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = await assertRankedCompetitiveAccess(ctx, user.userId)
    if (!gate.ok) return { ok: false as const, error: gate.error }
    const row = await ctx.db.get(args.friendshipId)
    if (!row || (row.userA !== user.userId && row.userB !== user.userId)) {
      return { ok: false as const, error: 'RANKED_FRIENDSHIP_NOT_FOUND' as const }
    }
    if (row.requestedBy === user.userId) {
      return { ok: false as const, error: 'RANKED_FRIENDSHIP_NOT_RECIPIENT' as const }
    }
    if (!args.accept) {
      await ctx.db.delete(row._id)
      return { ok: true as const, status: 'denied' as const }
    }
    await ctx.db.patch(row._id, { status: 'accepted', updatedAt: Date.now() })
    return { ok: true as const, status: 'accepted' as const }
  },
})

export const leaderboardFriends = query({
  args: {
    sessionToken: v.string(),
    axis: v.union(v.literal('force'), v.literal('discipline')),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const cycle = await getActiveCycle(ctx)
    if (!cycle) return { cycleId: null, entries: [], note: 'no_active_cycle' as const }

    const friendIds = await listAcceptedFriendIds(ctx, user.userId)
    const candidateIds = [user.userId, ...friendIds]
    const entries = []

    for (const uid of candidateIds) {
      const opt = await getOptIn(ctx, uid)
      if (!opt || opt.optedOutAt) continue
      if (args.axis === 'force' && !opt.forceEnabled) continue
      if (args.axis === 'discipline' && !opt.disciplineEnabled) continue

      const gate = await assertRankedCompetitiveAccess(ctx, uid)
      if (!gate.ok) continue

      const profile = await findProfileByUserId(ctx, uid)
      const avatarUrl = await publicAvatarUrl(ctx, profile)
      const pseudo = (profile?.pseudo?.trim() || 'Athlete').slice(0, 64)

      let score = 0
      if (args.axis === 'force') {
        const row = await ctx.db
          .query('rankedForceScore')
          .withIndex('by_user_cycle', (q) => q.eq('userId', uid).eq('cycleId', cycle._id))
          .first()
        score = row?.score ?? 0
      } else {
        const row = await ctx.db
          .query('rankedDisciplineScore')
          .withIndex('by_user_cycle', (q) => q.eq('userId', uid).eq('cycleId', cycle._id))
          .first()
        score = row?.score ?? 0
      }

      entries.push({
        userId: uid,
        pseudo,
        avatarUrl,
        score,
        isSelf: uid === user.userId,
      })
    }

    entries.sort((a, b) => b.score - a.score || a.pseudo.localeCompare(b.pseudo))
    return {
      cycleId: cycle._id,
      axis: args.axis,
      entries,
      // CA8 — salle = P0-bis documenté, hors P0
      gymLeaderboard: 'P0-bis — hors scope',
    }
  },
})

export const myLeague = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const cycle = await getActiveCycle(ctx)
    if (!cycle) return null
    const force = await ctx.db
      .query('rankedForceScore')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user.userId).eq('cycleId', cycle._id))
      .first()
    if (!force) return { cycleId: cycle._id, league: null, score: 0, approximateRank: null }

    const league = await ctx.db.get(force.leagueId)
    const peers = await ctx.db
      .query('rankedForceScore')
      .withIndex('by_cycle_score', (q) => q.eq('cycleId', cycle._id))
      .collect()
    const better = peers.filter((p) => p.score > force.score).length

    return {
      cycleId: cycle._id,
      score: force.score,
      breakdown: force.breakdown,
      league: league
        ? { id: league._id, name: league.name, tier: league.tier }
        : null,
      approximateRank: better + 1,
      cycleEndsAt: cycle.endsAt,
    }
  },
})

/**
 * Soft reset fin de cycle (CA6).
 * Re-placement partiel ligue ; ne wipe PAS rankedVerifiedPr.
 */
export const closeCycle = mutation({
  args: {
    sessionToken: v.string(),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    // Admin path: role admin OR internal cron via closeCycleCron.
    if (user.role !== 'admin') {
      return { ok: false as const, error: 'RANKED_ADMIN_REQUIRED' as const }
    }
    return closeCycleCore(ctx, Date.now())
  },
})

export const closeCycleCron = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const active = await ctx.db
      .query('rankedCycle')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .first()
    if (!active) {
      const created = await ensureActiveCycle(ctx, now)
      return {
        ok: true as const,
        closedCycleId: null,
        newCycleId: created._id,
        relocated: 0,
        verifiedPrWiped: false as const,
      }
    }
    if (active.endsAt > now) {
      return {
        ok: true as const,
        closedCycleId: null,
        newCycleId: active._id,
        relocated: 0,
        verifiedPrWiped: false as const,
        skipped: true as const,
      }
    }
    return closeCycleCore(ctx, now)
  },
})

async function closeCycleCore(ctx: MutationCtx, now: number) {
  const active = await ctx.db
    .query('rankedCycle')
    .withIndex('by_status', (q) => q.eq('status', 'active'))
    .first()
  if (!active) {
    const created = await ensureActiveCycle(ctx, now)
    return {
      ok: true as const,
      closedCycleId: null,
      newCycleId: created._id,
      relocated: 0,
      verifiedPrWiped: false as const,
    }
  }

  await ctx.db.patch(active._id, { status: 'closed', softResetAt: now })

  const oldScores = await ctx.db
    .query('rankedForceScore')
    .withIndex('by_cycle_score', (q) => q.eq('cycleId', active._id))
    .collect()

  const newCycle = await ensureActiveCycle(ctx, now)

  let relocated = 0
  for (const row of oldScores) {
    // Soft reset = re-placement partiel: carry score into new cycle leagues; PR carnet intact.
    const league = await leagueForScore(ctx, newCycle._id, row.score)
    await ctx.db.insert('rankedForceScore', {
      userId: row.userId,
      cycleId: newCycle._id,
      score: row.score,
      breakdown: row.breakdown,
      leagueId: league._id,
      updatedAt: now,
    })
    relocated += 1
  }

  // Carry discipline scores without wiping session history.
  const discScores = await ctx.db
    .query('rankedDisciplineScore')
    .withIndex('by_cycle_score', (q) => q.eq('cycleId', active._id))
    .collect()
  for (const row of discScores) {
    await ctx.db.insert('rankedDisciplineScore', {
      userId: row.userId,
      cycleId: newCycle._id,
      sessionsLast7d: row.sessionsLast7d,
      streakWeeks: row.streakWeeks,
      score: row.score,
      updatedAt: now,
    })
  }

  return {
    ok: true as const,
    closedCycleId: active._id,
    newCycleId: newCycle._id,
    relocated,
    verifiedPrWiped: false,
  }
}
