import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'
import { createOpaqueToken, hashToken } from './authCrypto'
import { getSessionTtlMs } from './authConfig'
import { consumeRateLimit } from './rateLimit'

/**
 * Auth guard for later Convex query/mutation work.
 * Phase A does not migrate Auth; this helper is unused by the React app.
 *
 * Every user-owned document must include `userId` matching this subject.
 * Never trust a client-supplied userId without this check.
 */
export async function requireAuthUser(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity.subject
}

type SessionCtx = QueryCtx | MutationCtx

export type SessionUser = {
  userId: string
  email: string
  displayName: string
  mustResetPassword: boolean
  role: 'admin' | 'user'
  deletedAt?: number
}

export function assertUserOwnership(ownerUserId: string, authUserId: string): void {
  if (ownerUserId !== authUserId) {
    throw new Error('Forbidden: cross-user access denied')
  }
}

export async function requireSessionUser(ctx: SessionCtx, sessionToken: string): Promise<SessionUser> {
  const tokenHash = await hashToken(sessionToken)
  const now = Date.now()
  const session = await ctx.db
    .query('auth_sessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!session || session.revokedAt || session.expiresAt <= now) {
    throw new Error('Not authenticated')
  }

  const user = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', session.userId))
    .first()
  if (!user || user.deletedAt) {
    throw new Error('Not authenticated')
  }
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    mustResetPassword: user.mustResetPassword,
    role: user.role === 'admin' ? 'admin' : 'user',
    deletedAt: user.deletedAt,
  }
}

export async function createSession(
  ctx: MutationCtx,
  userId: string,
): Promise<{ sessionToken: string; expiresAt: number }> {
  await consumeRateLimit(ctx, 'sessionCreate', { kind: 'userId', value: userId })
  const sessionToken = createOpaqueToken()
  const tokenHash = await hashToken(sessionToken)
  const now = Date.now()
  const expiresAt = now + getSessionTtlMs()
  await ctx.db.insert('auth_sessions', {
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
  })
  return { sessionToken, expiresAt }
}

export async function revokeSessionByToken(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<boolean> {
  const tokenHash = await hashToken(sessionToken)
  const existing = await ctx.db
    .query('auth_sessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!existing || existing.revokedAt) return false
  await ctx.db.patch(existing._id, { revokedAt: Date.now() })
  return true
}

export async function revokeAllUserSessions(ctx: MutationCtx, userId: string): Promise<number> {
  const sessions = await ctx.db
    .query('auth_sessions')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  let revoked = 0
  const now = Date.now()
  for (const session of sessions) {
    if (!session.revokedAt) {
      revoked += 1
      await ctx.db.patch(session._id, { revokedAt: now })
    }
  }
  return revoked
}
