import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'

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
