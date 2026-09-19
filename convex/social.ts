import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import { consumeRateLimit } from './lib/rateLimit'
import {
  GHOST_PSEUDO,
  areUsersBlocked,
  canViewerDiscoverSubject,
  canViewerSeeSubject,
  findAuthUserByUserId,
  findFollowPair,
  findProfileByUserId,
  isGhostProfile,
  publicProfileFields,
} from './lib/socialVisibility'

type SessionCtx = QueryCtx | MutationCtx

const PUBLIC_PROFILE_VALIDATOR = v.object({
  userId: v.string(),
  pseudo: v.string(),
  rank: v.string(),
  discipline: v.string(),
})

const VISIBLE_ACTIVITY_VALIDATOR = v.object({
  id: v.string(),
  user_id: v.string(),
  pseudo: v.string(),
  activity_type: v.string(),
  action_text: v.string(),
  xp_earned: v.number(),
  created_at: v.string(),
  is_self: v.boolean(),
  is_ghost_mode_enabled: v.boolean(),
})

const COMMENT_VALIDATOR = v.object({
  id: v.string(),
  activity_id: v.string(),
  pseudo: v.string(),
  body: v.string(),
  created_at: v.string(),
  is_self: v.boolean(),
})

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

function clipBody(value: string, max: number): string {
  return value.trim().slice(0, max)
}

async function requireExistingUser(ctx: SessionCtx, userId: string) {
  const user = await findAuthUserByUserId(ctx, userId)
  if (!user || user.deletedAt) return null
  return user
}

function mapVisibleActivity(
  row: {
    _id: string
    userId: string
    activityType: string
    actionText: string
    xpEarned: number
    createdAt: number
    deletedAt?: number
  },
  viewerUserId: string,
  profile: { pseudo?: string; isGhostModeEnabled?: boolean } | null,
) {
  const isSelf = row.userId === viewerUserId
  const ghost = isGhostProfile(profile)
  return {
    id: String(row._id),
    user_id: ghost && !isSelf ? '' : row.userId,
    pseudo: ghost && !isSelf ? GHOST_PSEUDO : (profile?.pseudo?.trim() || 'Athlete').slice(0, 64),
    activity_type: row.activityType,
    action_text: row.actionText,
    xp_earned: row.xpEarned,
    created_at: toIso(row.createdAt),
    is_self: isSelf,
    is_ghost_mode_enabled: ghost,
  }
}

async function removeFollowPair(ctx: MutationCtx, followerUserId: string, followeeUserId: string) {
  const row = await findFollowPair(ctx, followerUserId, followeeUserId)
  if (row) await ctx.db.delete(row._id)
}

export async function setAccountPrivacyForSession(
  ctx: MutationCtx,
  sessionToken: string,
  isPrivate: boolean,
): Promise<{ isPrivate: boolean }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const profile = await findProfileByUserId(ctx, user.userId)
  if (!profile) throw new Error('PROFILE_NOT_FOUND')
  assertUserOwnership(profile.userId, user.userId)
  await ctx.db.patch(profile._id, { isPrivate, updatedAt: Date.now() })
  if (!isPrivate) {
    const incoming = await ctx.db
      .query('user_follows')
      .withIndex('by_followee', (q) => q.eq('followeeUserId', user.userId))
      .collect()
    const now = Date.now()
    for (const row of incoming) {
      if (row.status === 'pending') {
        await ctx.db.patch(row._id, { status: 'accepted', updatedAt: now })
      }
    }
  }
  return { isPrivate }
}

export async function getVisibleProfileForSession(
  ctx: QueryCtx,
  sessionToken: string,
  targetUserId: string,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  if (!(await canViewerDiscoverSubject(ctx, viewer.userId, targetUserId))) return null
  const profile = await findProfileByUserId(ctx, targetUserId)
  if (!profile) return null
  return publicProfileFields(profile)
}

export async function searchProfilesForSession(
  ctx: QueryCtx,
  sessionToken: string,
  queryText: string,
  limit = 20,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const needle = queryText.trim().toLowerCase().slice(0, 32)
  if (needle.length < 2) return []
  const safeLimit = clamp(limit, 1, 20)
  const profiles = await ctx.db.query('profiles').collect()
  const matched = []
  for (const profile of profiles) {
    if (!profile.pseudo.toLowerCase().includes(needle)) continue
    if (!(await canViewerDiscoverSubject(ctx, viewer.userId, profile.userId))) continue
    matched.push(publicProfileFields(profile))
    if (matched.length >= safeLimit) break
  }
  return matched
}

export async function followUserForSession(
  ctx: MutationCtx,
  sessionToken: string,
  targetUserId: string,
): Promise<{ status: 'accepted' | 'pending' | 'blocked' }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'followUser', { kind: 'userId', value: viewer.userId })
  if (viewer.userId === targetUserId) throw new Error('FOLLOW_SELF_DENIED')
  const target = await requireExistingUser(ctx, targetUserId)
  if (!target) throw new Error('USER_NOT_FOUND')
  if (await areUsersBlocked(ctx, viewer.userId, targetUserId)) return { status: 'blocked' }
  const profile = await findProfileByUserId(ctx, targetUserId)
  if (!profile) throw new Error('USER_NOT_FOUND')
  const existing = await findFollowPair(ctx, viewer.userId, targetUserId)
  const now = Date.now()
  const nextStatus = profile.isPrivate ? 'pending' : 'accepted'
  if (existing) {
    if (existing.status === 'accepted') return { status: 'accepted' }
    if (existing.status === 'pending' && nextStatus === 'accepted') {
      await ctx.db.patch(existing._id, { status: 'accepted', updatedAt: now })
      return { status: 'accepted' }
    }
    return { status: existing.status }
  }
  await ctx.db.insert('user_follows', {
    followerUserId: viewer.userId,
    followeeUserId: targetUserId,
    status: nextStatus,
    createdAt: now,
    updatedAt: now,
  })
  return { status: nextStatus }
}

export async function unfollowUserForSession(
  ctx: MutationCtx,
  sessionToken: string,
  targetUserId: string,
): Promise<{ unfollowed: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const existing = await findFollowPair(ctx, viewer.userId, targetUserId)
  if (!existing) return { unfollowed: false }
  assertUserOwnership(existing.followerUserId, viewer.userId)
  await ctx.db.delete(existing._id)
  return { unfollowed: true }
}

export async function acceptFollowForSession(
  ctx: MutationCtx,
  sessionToken: string,
  followerUserId: string,
): Promise<{ accepted: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const existing = await findFollowPair(ctx, followerUserId, viewer.userId)
  if (!existing) return { accepted: false }
  assertUserOwnership(existing.followeeUserId, viewer.userId)
  if (existing.status === 'accepted') return { accepted: true }
  await ctx.db.patch(existing._id, { status: 'accepted', updatedAt: Date.now() })
  return { accepted: true }
}

export async function rejectFollowForSession(
  ctx: MutationCtx,
  sessionToken: string,
  followerUserId: string,
): Promise<{ rejected: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const existing = await findFollowPair(ctx, followerUserId, viewer.userId)
  if (!existing) return { rejected: false }
  assertUserOwnership(existing.followeeUserId, viewer.userId)
  await ctx.db.delete(existing._id)
  return { rejected: true }
}

export async function listFollowRequestsForSession(ctx: QueryCtx, sessionToken: string) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const incoming = await ctx.db
    .query('user_follows')
    .withIndex('by_followee', (q) => q.eq('followeeUserId', viewer.userId))
    .collect()
  return incoming
    .filter((row) => row.status === 'pending')
    .map((row) => ({ followerUserId: row.followerUserId, createdAt: row.createdAt }))
}

export async function listFollowersForSession(
  ctx: QueryCtx,
  sessionToken: string,
  targetUserId: string,
  limit = 50,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  if (!(await canViewerDiscoverSubject(ctx, viewer.userId, targetUserId))) return []
  const safeLimit = clamp(limit, 1, 50)
  const rows = await ctx.db
    .query('user_follows')
    .withIndex('by_followee', (q) => q.eq('followeeUserId', targetUserId))
    .collect()
  const out: Array<{ userId: string; pseudo: string }> = []
  for (const row of rows) {
    if (row.status !== 'accepted') continue
    if (!(await canViewerDiscoverSubject(ctx, viewer.userId, row.followerUserId))) continue
    const profile = await findProfileByUserId(ctx, row.followerUserId)
    if (!profile) continue
    out.push({ userId: profile.userId, pseudo: publicProfileFields(profile).pseudo })
    if (out.length >= safeLimit) break
  }
  return out
}

export async function listFollowingForSession(
  ctx: QueryCtx,
  sessionToken: string,
  targetUserId: string,
  limit = 50,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  if (!(await canViewerDiscoverSubject(ctx, viewer.userId, targetUserId))) return []
  const safeLimit = clamp(limit, 1, 50)
  const rows = await ctx.db
    .query('user_follows')
    .withIndex('by_follower', (q) => q.eq('followerUserId', targetUserId))
    .collect()
  const out: Array<{ userId: string; pseudo: string }> = []
  for (const row of rows) {
    if (row.status !== 'accepted') continue
    if (!(await canViewerDiscoverSubject(ctx, viewer.userId, row.followeeUserId))) continue
    const profile = await findProfileByUserId(ctx, row.followeeUserId)
    if (!profile) continue
    out.push({ userId: profile.userId, pseudo: publicProfileFields(profile).pseudo })
    if (out.length >= safeLimit) break
  }
  return out
}

export async function blockUserForSession(
  ctx: MutationCtx,
  sessionToken: string,
  targetUserId: string,
): Promise<{ blocked: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'blockUser', { kind: 'userId', value: viewer.userId })
  if (viewer.userId === targetUserId) throw new Error('BLOCK_SELF_DENIED')
  const target = await requireExistingUser(ctx, targetUserId)
  if (!target) throw new Error('USER_NOT_FOUND')
  const existing = await ctx.db
    .query('user_blocks')
    .withIndex('by_pair', (q) =>
      q.eq('blockerUserId', viewer.userId).eq('blockedUserId', targetUserId),
    )
    .first()
  await removeFollowPair(ctx, viewer.userId, targetUserId)
  await removeFollowPair(ctx, targetUserId, viewer.userId)
  if (existing) return { blocked: true }
  await ctx.db.insert('user_blocks', {
    blockerUserId: viewer.userId,
    blockedUserId: targetUserId,
    createdAt: Date.now(),
  })
  return { blocked: true }
}

export async function unblockUserForSession(
  ctx: MutationCtx,
  sessionToken: string,
  targetUserId: string,
): Promise<{ unblocked: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const existing = await ctx.db
    .query('user_blocks')
    .withIndex('by_pair', (q) =>
      q.eq('blockerUserId', viewer.userId).eq('blockedUserId', targetUserId),
    )
    .first()
  if (!existing) return { unblocked: false }
  assertUserOwnership(existing.blockerUserId, viewer.userId)
  await ctx.db.delete(existing._id)
  return { unblocked: true }
}

export async function listBlockedUsersForSession(ctx: QueryCtx, sessionToken: string) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const rows = await ctx.db
    .query('user_blocks')
    .withIndex('by_blocker', (q) => q.eq('blockerUserId', viewer.userId))
    .collect()
  return rows.map((row) => ({ userId: row.blockedUserId, createdAt: row.createdAt }))
}

export async function getVisibleActivityForSession(
  ctx: QueryCtx,
  sessionToken: string,
  activityId: string,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const row = await ctx.db.get(activityId as Id<'activities'>)
  if (!row || row.deletedAt) return null
  if (!(await canViewerSeeSubject(ctx, viewer.userId, row.userId))) return null
  const profile = await findProfileByUserId(ctx, row.userId)
  return mapVisibleActivity(row, viewer.userId, profile)
}

export async function listVisibleActivitiesForSession(
  ctx: QueryCtx,
  sessionToken: string,
  targetUserId: string,
  limit = 20,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  if (!(await canViewerDiscoverSubject(ctx, viewer.userId, targetUserId))) return []
  const safeLimit = clamp(limit, 1, 50)
  const rows = await ctx.db
    .query('activities')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', targetUserId))
    .collect()
  const profile = await findProfileByUserId(ctx, targetUserId)
  return rows
    .filter((row) => !row.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, safeLimit)
    .map((row) => mapVisibleActivity(row, viewer.userId, profile))
}

export async function countVisibleActivitiesForSession(
  ctx: QueryCtx,
  sessionToken: string,
  targetUserId: string,
): Promise<number> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  if (!(await canViewerDiscoverSubject(ctx, viewer.userId, targetUserId))) return 0
  const rows = await ctx.db
    .query('activities')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', targetUserId))
    .collect()
  return rows.filter((row) => !row.deletedAt).length
}

export async function deleteOwnActivityForSession(
  ctx: MutationCtx,
  sessionToken: string,
  activityId: string,
): Promise<{ deleted: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const row = await ctx.db.get(activityId as Id<'activities'>)
  if (!row || row.deletedAt) return { deleted: false }
  if (row.userId !== viewer.userId) throw new Error('Forbidden: cross-user access denied')
  assertUserOwnership(row.userId, viewer.userId)
  const now = Date.now()
  await ctx.db.patch(row._id, { deletedAt: now })
  return { deleted: true }
}

export async function addCommentForSession(
  ctx: MutationCtx,
  sessionToken: string,
  activityId: string,
  body: string,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'createComment', { kind: 'userId', value: viewer.userId })
  const activity = await ctx.db.get(activityId as Id<'activities'>)
  if (!activity || activity.deletedAt) throw new Error('ACTIVITY_NOT_FOUND')
  if (!(await canViewerSeeSubject(ctx, viewer.userId, activity.userId))) {
    throw new Error('Forbidden: cross-user access denied')
  }
  const trimmed = clipBody(body, 280)
  if (!trimmed) throw new Error('COMMENT_EMPTY')
  const now = Date.now()
  const id = await ctx.db.insert('activity_comments', {
    activityId: activity._id,
    userId: viewer.userId,
    body: trimmed,
    createdAt: now,
  })
  const profile = await findProfileByUserId(ctx, viewer.userId)
  return {
    id: String(id),
    activity_id: String(activity._id),
    pseudo: (profile?.pseudo?.trim() || 'Athlete').slice(0, 64),
    body: trimmed,
    created_at: toIso(now),
    is_self: true,
  }
}

export async function deleteCommentForSession(
  ctx: MutationCtx,
  sessionToken: string,
  commentId: string,
): Promise<{ deleted: boolean }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const comment = await ctx.db.get(commentId as Id<'activity_comments'>)
  if (!comment || comment.deletedAt) return { deleted: false }
  const activity = await ctx.db.get(comment.activityId)
  const isCommentOwner = comment.userId === viewer.userId
  const isActivityOwner = activity?.userId === viewer.userId
  if (!isCommentOwner && !isActivityOwner) {
    throw new Error('Forbidden: cross-user access denied')
  }
  await ctx.db.patch(comment._id, { deletedAt: Date.now() })
  return { deleted: true }
}

export async function listCommentsForSession(
  ctx: QueryCtx,
  sessionToken: string,
  activityId: string,
  limit = 50,
) {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const activity = await ctx.db.get(activityId as Id<'activities'>)
  if (!activity || activity.deletedAt) return []
  if (!(await canViewerSeeSubject(ctx, viewer.userId, activity.userId))) return []
  const safeLimit = clamp(limit, 1, 50)
  const rows = await ctx.db
    .query('activity_comments')
    .withIndex('by_activityId', (q) => q.eq('activityId', activity._id))
    .collect()
  const out: Array<{
    id: string
    activity_id: string
    pseudo: string
    body: string
    created_at: string
    is_self: boolean
  }> = []
  const sorted = rows.sort((a, b) => a.createdAt - b.createdAt)
  for (const row of sorted) {
    if (row.deletedAt) continue
    if (!(await canViewerSeeSubject(ctx, viewer.userId, row.userId))) continue
    const profile = await findProfileByUserId(ctx, row.userId)
    const isSelf = row.userId === viewer.userId
    const ghost = isGhostProfile(profile) && !isSelf
    out.push({
      id: String(row._id),
      activity_id: String(row.activityId),
      pseudo: ghost ? GHOST_PSEUDO : (profile?.pseudo?.trim() || 'Athlete').slice(0, 64),
      body: row.body,
      created_at: toIso(row.createdAt),
      is_self: isSelf,
    })
    if (out.length >= safeLimit) break
  }
  return out
}

export async function toggleReactionForSession(
  ctx: MutationCtx,
  sessionToken: string,
  activityId: string,
): Promise<{ cheered: boolean; count: number }> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'toggleReaction', { kind: 'userId', value: viewer.userId })
  const activity = await ctx.db.get(activityId as Id<'activities'>)
  if (!activity || activity.deletedAt) throw new Error('ACTIVITY_NOT_FOUND')
  if (!(await canViewerSeeSubject(ctx, viewer.userId, activity.userId))) {
    throw new Error('Forbidden: cross-user access denied')
  }
  const existing = await ctx.db
    .query('activity_reactions')
    .withIndex('by_activity_user', (q) =>
      q.eq('activityId', activity._id).eq('userId', viewer.userId),
    )
    .first()
  if (existing) {
    assertUserOwnership(existing.userId, viewer.userId)
    await ctx.db.delete(existing._id)
  } else {
    await ctx.db.insert('activity_reactions', {
      activityId: activity._id,
      userId: viewer.userId,
      kind: 'cheer',
      createdAt: Date.now(),
    })
  }
  const count = await countVisibleReactions(ctx, viewer.userId, activity._id)
  return { cheered: !existing, count }
}

export async function countReactionsForSession(
  ctx: QueryCtx,
  sessionToken: string,
  activityId: string,
): Promise<number> {
  const viewer = await requireSessionUser(ctx, sessionToken)
  const activity = await ctx.db.get(activityId as Id<'activities'>)
  if (!activity || activity.deletedAt) return 0
  if (!(await canViewerSeeSubject(ctx, viewer.userId, activity.userId))) return 0
  return countVisibleReactions(ctx, viewer.userId, activity._id)
}

async function countVisibleReactions(
  ctx: SessionCtx,
  viewerUserId: string,
  activityId: Id<'activities'>,
): Promise<number> {
  const rows = await ctx.db
    .query('activity_reactions')
    .withIndex('by_activityId', (q) => q.eq('activityId', activityId))
    .collect()
  let count = 0
  for (const row of rows) {
    if (await canViewerSeeSubject(ctx, viewerUserId, row.userId)) count += 1
  }
  return count
}

export const setAccountPrivacy = mutation({
  args: { sessionToken: v.string(), isPrivate: v.boolean() },
  returns: v.object({ isPrivate: v.boolean() }),
  handler: (ctx, args) => setAccountPrivacyForSession(ctx, args.sessionToken, args.isPrivate),
})

export const getVisibleProfile = query({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.union(PUBLIC_PROFILE_VALIDATOR, v.null()),
  handler: (ctx, args) => getVisibleProfileForSession(ctx, args.sessionToken, args.targetUserId),
})

export const searchProfiles = query({
  args: {
    sessionToken: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(PUBLIC_PROFILE_VALIDATOR),
  handler: (ctx, args) => searchProfilesForSession(ctx, args.sessionToken, args.query, args.limit),
})

export const followUser = mutation({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.object({
    status: v.union(v.literal('accepted'), v.literal('pending'), v.literal('blocked')),
  }),
  handler: (ctx, args) => followUserForSession(ctx, args.sessionToken, args.targetUserId),
})

export const unfollowUser = mutation({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.object({ unfollowed: v.boolean() }),
  handler: (ctx, args) => unfollowUserForSession(ctx, args.sessionToken, args.targetUserId),
})

export const acceptFollow = mutation({
  args: { sessionToken: v.string(), followerUserId: v.string() },
  returns: v.object({ accepted: v.boolean() }),
  handler: (ctx, args) => acceptFollowForSession(ctx, args.sessionToken, args.followerUserId),
})

export const rejectFollow = mutation({
  args: { sessionToken: v.string(), followerUserId: v.string() },
  returns: v.object({ rejected: v.boolean() }),
  handler: (ctx, args) => rejectFollowForSession(ctx, args.sessionToken, args.followerUserId),
})

export const listFollowRequests = query({
  args: { sessionToken: v.string() },
  returns: v.array(
    v.object({
      followerUserId: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: (ctx, args) => listFollowRequestsForSession(ctx, args.sessionToken),
})

export const listFollowers = query({
  args: {
    sessionToken: v.string(),
    targetUserId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({ userId: v.string(), pseudo: v.string() })),
  handler: (ctx, args) =>
    listFollowersForSession(ctx, args.sessionToken, args.targetUserId, args.limit),
})

export const listFollowing = query({
  args: {
    sessionToken: v.string(),
    targetUserId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({ userId: v.string(), pseudo: v.string() })),
  handler: (ctx, args) =>
    listFollowingForSession(ctx, args.sessionToken, args.targetUserId, args.limit),
})

export const blockUser = mutation({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.object({ blocked: v.boolean() }),
  handler: (ctx, args) => blockUserForSession(ctx, args.sessionToken, args.targetUserId),
})

export const unblockUser = mutation({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.object({ unblocked: v.boolean() }),
  handler: (ctx, args) => unblockUserForSession(ctx, args.sessionToken, args.targetUserId),
})

export const listBlockedUsers = query({
  args: { sessionToken: v.string() },
  returns: v.array(v.object({ userId: v.string(), createdAt: v.number() })),
  handler: (ctx, args) => listBlockedUsersForSession(ctx, args.sessionToken),
})

export const getVisibleActivity = query({
  args: { sessionToken: v.string(), activityId: v.string() },
  returns: v.union(VISIBLE_ACTIVITY_VALIDATOR, v.null()),
  handler: (ctx, args) => getVisibleActivityForSession(ctx, args.sessionToken, args.activityId),
})

export const listVisibleActivities = query({
  args: {
    sessionToken: v.string(),
    targetUserId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(VISIBLE_ACTIVITY_VALIDATOR),
  handler: (ctx, args) =>
    listVisibleActivitiesForSession(ctx, args.sessionToken, args.targetUserId, args.limit),
})

export const countVisibleActivities = query({
  args: { sessionToken: v.string(), targetUserId: v.string() },
  returns: v.number(),
  handler: (ctx, args) =>
    countVisibleActivitiesForSession(ctx, args.sessionToken, args.targetUserId),
})

export const deleteOwnActivity = mutation({
  args: { sessionToken: v.string(), activityId: v.string() },
  returns: v.object({ deleted: v.boolean() }),
  handler: (ctx, args) => deleteOwnActivityForSession(ctx, args.sessionToken, args.activityId),
})

export const addComment = mutation({
  args: {
    sessionToken: v.string(),
    activityId: v.string(),
    body: v.string(),
  },
  returns: COMMENT_VALIDATOR,
  handler: (ctx, args) => addCommentForSession(ctx, args.sessionToken, args.activityId, args.body),
})

export const deleteComment = mutation({
  args: { sessionToken: v.string(), commentId: v.string() },
  returns: v.object({ deleted: v.boolean() }),
  handler: (ctx, args) => deleteCommentForSession(ctx, args.sessionToken, args.commentId),
})

export const listComments = query({
  args: {
    sessionToken: v.string(),
    activityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(COMMENT_VALIDATOR),
  handler: (ctx, args) => listCommentsForSession(ctx, args.sessionToken, args.activityId, args.limit),
})

export const toggleReaction = mutation({
  args: { sessionToken: v.string(), activityId: v.string() },
  returns: v.object({ cheered: v.boolean(), count: v.number() }),
  handler: (ctx, args) => toggleReactionForSession(ctx, args.sessionToken, args.activityId),
})

export const countReactions = query({
  args: { sessionToken: v.string(), activityId: v.string() },
  returns: v.number(),
  handler: (ctx, args) => countReactionsForSession(ctx, args.sessionToken, args.activityId),
})
