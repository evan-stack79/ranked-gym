import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

const DEFAULT_DISCIPLINE = 'Musculation'
const DEFAULT_RANK = 'Bronze'

export type ConvexProfileView = {
  userId: string
  pseudo: string
  level: number
  xp: number
  rank: string
  discipline: string
  isGhostModeEnabled: boolean
  isPrivate: boolean
  sportIds?: string[]
  sportsUndecided?: boolean
  avatarFileId?: Id<'user_files'>
  currentStreak: number
  lastLoginDate: string | null
  createdAt: number
  updatedAt: number
}

const profileViewValidator = v.object({
  userId: v.string(),
  pseudo: v.string(),
  level: v.number(),
  xp: v.number(),
  rank: v.string(),
  discipline: v.string(),
  isGhostModeEnabled: v.boolean(),
  isPrivate: v.boolean(),
  sportIds: v.optional(v.array(v.string())),
  sportsUndecided: v.optional(v.boolean()),
  avatarFileId: v.optional(v.id('user_files')),
  currentStreak: v.number(),
  lastLoginDate: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function clip(value: string, max: number, fallback: string): string {
  const trimmed = value.trim()
  return (trimmed || fallback).slice(0, max)
}

async function findProfile(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function findStreak(ctx: QueryCtx | MutationCtx, userId: string) {
  return ctx.db
    .query('streak_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export async function toProfileView(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<ConvexProfileView | null> {
  const profile = await findProfile(ctx, userId)
  if (!profile) return null
  assertUserOwnership(profile.userId, userId)
  const streak = await findStreak(ctx, userId)
  if (streak) assertUserOwnership(streak.userId, userId)
  return {
    userId: profile.userId,
    pseudo: profile.pseudo,
    level: profile.level,
    xp: profile.xp,
    rank: profile.rank,
    discipline: profile.discipline,
    isGhostModeEnabled: profile.isGhostModeEnabled,
    isPrivate: Boolean(profile.isPrivate),
    sportIds: profile.sportIds,
    sportsUndecided: profile.sportsUndecided,
    avatarFileId: profile.avatarFileId,
    currentStreak: streak?.currentStreak ?? 0,
    lastLoginDate: streak?.lastLoginDate ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }
}

export async function getProfileForSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<ConvexProfileView | null> {
  const user = await requireSessionUser(ctx, sessionToken)
  return toProfileView(ctx, user.userId)
}

export async function ensureProfileForSession(
  ctx: MutationCtx,
  sessionToken: string,
  pseudo: string,
  disciplineLabel = DEFAULT_DISCIPLINE,
): Promise<ConvexProfileView> {
  const user = await requireSessionUser(ctx, sessionToken)
  const existing = await toProfileView(ctx, user.userId)
  if (existing) return existing

  const now = Date.now()
  await ctx.db.insert('profiles', {
    userId: user.userId,
    pseudo: clip(pseudo || user.displayName, 24, 'Athlete'),
    level: 1,
    xp: 0,
    rank: DEFAULT_RANK,
    discipline: clip(disciplineLabel, 40, DEFAULT_DISCIPLINE),
    isGhostModeEnabled: false,
    isPrivate: false,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('streak_state', {
    userId: user.userId,
    currentStreak: 0,
    lastLoginDate: null,
    updatedAt: now,
  })
  const created = await toProfileView(ctx, user.userId)
  if (!created) throw new Error('PROFILE_ENSURE_FAILED')
  return created
}

export async function updateProfileForSession(
  ctx: MutationCtx,
  sessionToken: string,
  patch: {
    level?: number
    xp?: number
    rank?: string
    pseudo?: string
    discipline?: string
    isGhostModeEnabled?: boolean
    isPrivate?: boolean
    sportIds?: string[]
    sportsUndecided?: boolean
    currentStreak?: number
    lastLoginDate?: string | null
  },
): Promise<ConvexProfileView> {
  const user = await requireSessionUser(ctx, sessionToken)
  const profile = await findProfile(ctx, user.userId)
  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND')
  }
  assertUserOwnership(profile.userId, user.userId)
  const now = Date.now()
  await ctx.db.patch(profile._id, {
    updatedAt: now,
    ...(typeof patch.level === 'number' ? { level: patch.level } : {}),
    ...(typeof patch.xp === 'number' ? { xp: patch.xp } : {}),
    ...(typeof patch.rank === 'string' ? { rank: patch.rank } : {}),
    ...(typeof patch.pseudo === 'string' ? { pseudo: clip(patch.pseudo, 24, profile.pseudo) } : {}),
    ...(typeof patch.discipline === 'string'
      ? { discipline: clip(patch.discipline, 40, profile.discipline) }
      : {}),
    ...(typeof patch.isGhostModeEnabled === 'boolean'
      ? { isGhostModeEnabled: patch.isGhostModeEnabled }
      : {}),
    ...(typeof patch.isPrivate === 'boolean' ? { isPrivate: patch.isPrivate } : {}),
    ...(Array.isArray(patch.sportIds) ? { sportIds: patch.sportIds.slice(0, 32) } : {}),
    ...(typeof patch.sportsUndecided === 'boolean' ? { sportsUndecided: patch.sportsUndecided } : {}),
  })

  if (patch.currentStreak != null || patch.lastLoginDate !== undefined) {
    const streak = await findStreak(ctx, user.userId)
    const streakPatch = {
      currentStreak: patch.currentStreak ?? streak?.currentStreak ?? 0,
      lastLoginDate: patch.lastLoginDate === undefined ? (streak?.lastLoginDate ?? null) : patch.lastLoginDate,
      updatedAt: now,
    }
    if (streak) {
      assertUserOwnership(streak.userId, user.userId)
      await ctx.db.patch(streak._id, streakPatch)
    } else {
      await ctx.db.insert('streak_state', { userId: user.userId, ...streakPatch })
    }
  }

  const updated = await toProfileView(ctx, user.userId)
  if (!updated) throw new Error('PROFILE_UPDATE_FAILED')
  return updated
}

export type ApplyStreakResult = {
  didUpdate: boolean
  profile: ConvexProfileView
}

/**
 * Conditional streak write (CAS on lastLoginDate), matching the Supabase
 * `last_login_date` optimistic lock so two devices cannot double-increment.
 */
export async function applyDailyLoginStreakForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    expectedLastLoginDate: string | null
    today: string
    nextStreak: number
    nextLevel: number
    nextXp: number
    nextRank: string
  },
): Promise<ApplyStreakResult> {
  const user = await requireSessionUser(ctx, sessionToken)
  await ensureProfileForSession(ctx, sessionToken, user.displayName)
  const streak = await findStreak(ctx, user.userId)
  const currentLast = streak?.lastLoginDate ?? null
  if (currentLast !== input.expectedLastLoginDate) {
    const profile = await toProfileView(ctx, user.userId)
    if (!profile) throw new Error('PROFILE_NOT_FOUND')
    return { didUpdate: false, profile }
  }

  const previousStreak = streak?.currentStreak ?? 0
  if (input.nextStreak !== 1 && input.nextStreak !== previousStreak + 1) {
    throw new Error('STREAK_TRANSITION_INVALID')
  }

  const now = Date.now()
  const streakPatch = {
    currentStreak: input.nextStreak,
    lastLoginDate: input.today,
    updatedAt: now,
  }
  if (streak) {
    assertUserOwnership(streak.userId, user.userId)
    await ctx.db.patch(streak._id, streakPatch)
  } else {
    await ctx.db.insert('streak_state', { userId: user.userId, ...streakPatch })
  }

  const profile = await findProfile(ctx, user.userId)
  if (!profile) throw new Error('PROFILE_NOT_FOUND')
  assertUserOwnership(profile.userId, user.userId)
  await ctx.db.patch(profile._id, {
    level: input.nextLevel,
    xp: input.nextXp,
    rank: input.nextRank,
    updatedAt: now,
  })

  const view = await toProfileView(ctx, user.userId)
  if (!view) throw new Error('PROFILE_UPDATE_FAILED')
  return { didUpdate: true, profile: view }
}

export const getProfile = query({
  args: { sessionToken: v.string() },
  returns: v.union(profileViewValidator, v.null()),
  handler: (ctx, args) => getProfileForSession(ctx, args.sessionToken),
})

export const ensureProfile = mutation({
  args: {
    sessionToken: v.string(),
    pseudo: v.string(),
    discipline: v.optional(v.string()),
  },
  returns: profileViewValidator,
  handler: (ctx, args) =>
    ensureProfileForSession(ctx, args.sessionToken, args.pseudo, args.discipline),
})

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    level: v.optional(v.number()),
    xp: v.optional(v.number()),
    rank: v.optional(v.string()),
    pseudo: v.optional(v.string()),
    discipline: v.optional(v.string()),
    isGhostModeEnabled: v.optional(v.boolean()),
    isPrivate: v.optional(v.boolean()),
    currentStreak: v.optional(v.number()),
    lastLoginDate: v.optional(v.union(v.string(), v.null())),
  },
  returns: profileViewValidator,
  handler: (ctx, args) =>
    updateProfileForSession(ctx, args.sessionToken, {
      level: args.level,
      xp: args.xp,
      rank: args.rank,
      pseudo: args.pseudo,
      discipline: args.discipline,
      isGhostModeEnabled: args.isGhostModeEnabled,
      isPrivate: args.isPrivate,
      currentStreak: args.currentStreak,
      lastLoginDate: args.lastLoginDate,
    }),
})

export const applyDailyLoginStreak = mutation({
  args: {
    sessionToken: v.string(),
    expectedLastLoginDate: v.union(v.string(), v.null()),
    today: v.string(),
    nextStreak: v.number(),
    nextLevel: v.number(),
    nextXp: v.number(),
    nextRank: v.string(),
  },
  returns: v.object({
    didUpdate: v.boolean(),
    profile: profileViewValidator,
  }),
  handler: (ctx, args) =>
    applyDailyLoginStreakForSession(ctx, args.sessionToken, {
      expectedLastLoginDate: args.expectedLastLoginDate,
      today: args.today,
      nextStreak: args.nextStreak,
      nextLevel: args.nextLevel,
      nextXp: args.nextXp,
      nextRank: args.nextRank,
    }),
})
