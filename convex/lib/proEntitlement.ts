/**
 * Pont AB-g — Hydratation v2 + Ranked Pro Solo.
 *
 * Source unique du droit Pro cosmétique : `subscriptionAccess` (chaînes vérifiées).
 * La table `proEntitlements` reste en inventaire legacy uniquement —
 * un `activeUntil` sans reçu / grant tracé ne donne PAS Pro.
 *
 * Aucun lien Force / Discipline / RP.
 */
import type { MutationCtx } from '../_generated/server'
import { applyVerifiedStateCore } from './subscriptionApply'

export {
  hasActivePro,
  requirePro,
  loadProStatusForUser,
} from './subscriptionAccess'

/** Garde cosmétique explicite pour mode my_bottle (HY-13). */
export async function assertMyBottlePro(
  ctx: Parameters<typeof import('./subscriptionAccess').requirePro>[0],
  userId: string,
  now = Date.now(),
): Promise<void> {
  const { requirePro } = await import('./subscriptionAccess')
  await requirePro(ctx, userId, now)
}

/**
 * Grant interne tests/seed (équivalent historique `setProEntitlementForTests`).
 * Écrit la projection via `applyVerifiedStateCore` (local_test) — jamais un flag client.
 * Met aussi à jour `proEntitlements` pour inventaire / migration, sans en faire l’autorité.
 */
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
  } else {
    await ctx.db.insert('proEntitlements', { userId, activeUntil, updatedAt: now })
  }

  await applyVerifiedStateCore(ctx, {
    userId,
    source: 'apple',
    environment: 'local_test',
    storeChainKey: `localtest:${userId}`,
    latestTransactionId: `localtest-tx-${now}`,
    productId: 'ranked.pro.solo.monthly',
    billingPeriod: 'month',
    status: activeUntil > now ? 'trial' : 'expired',
    periodEndsAt: activeUntil,
    trialEndsAt: activeUntil,
    autoRenew: true,
    isTrial: true,
    billingRetry: false,
    actor: 'setProEntitlementForTests',
    eventType: 'local_test_grant',
    payloadHash: `localtest:${userId}:${activeUntil}`,
  })
}
