/**
 * Pass Pro cosmétique (Ma bouteille). Aucun lien Force / Discipline / RP.
 */
import type { MutationCtx, QueryCtx } from '../_generated/server'

type DbCtx = MutationCtx | QueryCtx

export async function hasActivePro(
  ctx: DbCtx,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const row = await ctx.db
    .query('proEntitlements')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
  if (!row) return false
  return typeof row.activeUntil === 'number' && row.activeUntil > now
}

export async function setProEntitlementForTests(
  ctx: MutationCtx,
  userId: string,
  activeUntil: number,
  now = Date.now(),
): Promise<void> {
  const existing = await ctx.db
    .query('proEntitlements')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
  if (existing) {
    await ctx.db.patch(existing._id, { activeUntil, updatedAt: now })
    return
  }
  await ctx.db.insert('proEntitlements', { userId, activeUntil, updatedAt: now })
}
