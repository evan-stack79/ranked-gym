import type { MutationCtx, QueryCtx } from '../_generated/server'

type VisibilityCtx = QueryCtx | MutationCtx

const GHOST_PSEUDO = 'Athlete Furtif'

export { GHOST_PSEUDO }

/**
 * Server-side social visibility. Identity is always the session userId —
 * never a client-supplied viewer id, role, or visibility override.
 *
 * Rules:
 * - Self can always see own non-deleted content.
 * - Reciprocal blocks hide both directions.
 * - Deleted accounts are invisible.
 * - Private accounts are visible only to self and accepted followers.
 * - Ghost mode is discovery-hiding (search / profile / list-by-userId), not a
 *   client-supplied flag. Addressable activity ids still return redacted rows.
 */
export async function findProfileByUserId(ctx: VisibilityCtx, userId: string) {
  return ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export async function findAuthUserByUserId(ctx: VisibilityCtx, userId: string) {
  return ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export async function areUsersBlocked(
  ctx: VisibilityCtx,
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  if (userIdA === userIdB) return false
  const forward = await ctx.db
    .query('user_blocks')
    .withIndex('by_pair', (q) => q.eq('blockerUserId', userIdA).eq('blockedUserId', userIdB))
    .first()
  if (forward) return true
  const reverse = await ctx.db
    .query('user_blocks')
    .withIndex('by_pair', (q) => q.eq('blockerUserId', userIdB).eq('blockedUserId', userIdA))
    .first()
  return Boolean(reverse)
}

export async function findFollowPair(
  ctx: VisibilityCtx,
  followerUserId: string,
  followeeUserId: string,
) {
  return ctx.db
    .query('user_follows')
    .withIndex('by_pair', (q) =>
      q.eq('followerUserId', followerUserId).eq('followeeUserId', followeeUserId),
    )
    .first()
}

export async function hasAcceptedFollow(
  ctx: VisibilityCtx,
  followerUserId: string,
  followeeUserId: string,
): Promise<boolean> {
  const row = await findFollowPair(ctx, followerUserId, followeeUserId)
  return row?.status === 'accepted'
}

export function isProfilePrivate(profile: { isPrivate?: boolean } | null): boolean {
  return Boolean(profile?.isPrivate)
}

export function isGhostProfile(profile: { isGhostModeEnabled?: boolean } | null): boolean {
  return Boolean(profile?.isGhostModeEnabled)
}

export async function canViewerSeeSubject(
  ctx: VisibilityCtx,
  viewerUserId: string,
  subjectUserId: string,
): Promise<boolean> {
  if (viewerUserId === subjectUserId) return true
  const subject = await findAuthUserByUserId(ctx, subjectUserId)
  if (!subject || subject.deletedAt) return false
  if (await areUsersBlocked(ctx, viewerUserId, subjectUserId)) return false
  const profile = await findProfileByUserId(ctx, subjectUserId)
  if (!profile) return false
  if (isProfilePrivate(profile)) {
    return hasAcceptedFollow(ctx, viewerUserId, subjectUserId)
  }
  return true
}

/** Search / profile-by-id / list-by-userId must not reveal ghost or private users. */
export async function canViewerDiscoverSubject(
  ctx: VisibilityCtx,
  viewerUserId: string,
  subjectUserId: string,
): Promise<boolean> {
  if (viewerUserId === subjectUserId) return true
  if (!(await canViewerSeeSubject(ctx, viewerUserId, subjectUserId))) return false
  const profile = await findProfileByUserId(ctx, subjectUserId)
  if (!profile || isGhostProfile(profile)) return false
  return true
}

export function publicProfileFields(profile: {
  userId: string
  pseudo: string
  rank: string
  discipline: string
}) {
  return {
    userId: profile.userId,
    pseudo: profile.pseudo.trim().slice(0, 64) || 'Athlete',
    rank: profile.rank,
    discipline: profile.discipline,
  }
}
