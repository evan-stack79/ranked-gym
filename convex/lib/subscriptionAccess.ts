/**
 * Droit Pro serveur (ARCHI §3.3 / §4 / §9).
 * Aucun module ranked* / rewards* ne doit importer ce fichier pour un calcul compétitif.
 */
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { SubscriptionAccessState, SubscriptionChainStatus } from '../../shared/subscriptions/constants'
import { readSubscriptionEnv } from './subscriptionEnv'
import { PRO_FAMILY_SHARING_ENABLED } from '../../shared/subscriptions/constants'

type DbCtx = MutationCtx | QueryCtx

export type ProStatusView = {
  active: boolean
  state: SubscriptionAccessState
  plan: 'solo' | null
  origin: 'apple' | 'google' | 'admin' | null
  accessUntil: number | null
  trialEndsAt: number | null
  autoRenew: boolean | null
  managementTargets: Array<{
    source: 'apple' | 'google'
    productId: string
    url: string
  }>
}

const ACTIVE_CHAIN_STATUSES: ReadonlySet<SubscriptionChainStatus> = new Set([
  'trial',
  'active',
  'canceled_active_until',
  'grace',
])

export function chainGrantsAccess(
  status: SubscriptionChainStatus,
  now: number,
  periodEndsAt?: number | null,
  trialEndsAt?: number | null,
  graceEndsAt?: number | null,
  familyShared?: boolean | null,
): boolean {
  if (!PRO_FAMILY_SHARING_ENABLED && familyShared === true) return false
  if (!ACTIVE_CHAIN_STATUSES.has(status)) return false
  if (status === 'grace') {
    return typeof graceEndsAt === 'number' && graceEndsAt > now
  }
  if (status === 'trial') {
    const end = trialEndsAt ?? periodEndsAt
    return typeof end === 'number' && end > now
  }
  const end = periodEndsAt ?? trialEndsAt
  return typeof end === 'number' && end > now
}

export function accessUntilForChain(
  status: SubscriptionChainStatus,
  periodEndsAt?: number | null,
  trialEndsAt?: number | null,
  graceEndsAt?: number | null,
): number | null {
  if (status === 'grace') return graceEndsAt ?? null
  if (status === 'trial') return trialEndsAt ?? periodEndsAt ?? null
  return periodEndsAt ?? trialEndsAt ?? null
}

export function pickWinningChain(
  chains: Doc<'subscriptions'>[],
  now: number,
): Doc<'subscriptions'> | null {
  const eligible = chains
    .filter((c) =>
      chainGrantsAccess(
        c.status,
        now,
        c.periodEndsAt,
        c.trialEndsAt,
        c.graceEndsAt,
        c.familyShared,
      ),
    )
    .sort((a, b) => {
      const aUntil = accessUntilForChain(a.status, a.periodEndsAt, a.trialEndsAt, a.graceEndsAt) ?? 0
      const bUntil = accessUntilForChain(b.status, b.periodEndsAt, b.trialEndsAt, b.graceEndsAt) ?? 0
      return bUntil - aUntil
    })
  return eligible[0] ?? null
}

export async function loadProStatusForUser(
  ctx: DbCtx,
  userId: string,
  now = Date.now(),
): Promise<ProStatusView> {
  const chains = await ctx.db
    .query('subscriptions')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  const winner = pickWinningChain(chains, now)
  const managementTargets = chains
    .filter((c) => c.source === 'apple' || c.source === 'google')
    .map((c) => ({
      source: c.source as 'apple' | 'google',
      productId: c.productId,
      url:
        c.source === 'apple'
          ? 'https://apps.apple.com/account/subscriptions'
          : `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(c.productId)}&package=${encodeURIComponent(readSubscriptionEnv('GOOGLE_PLAY_PACKAGE_NAME') ?? 'com.rankedgym.app')}`,
    }))

  if (!winner) {
    return {
      active: false,
      state: 'free',
      plan: null,
      origin: null,
      accessUntil: null,
      trialEndsAt: null,
      autoRenew: null,
      managementTargets,
    }
  }

  return {
    active: true,
    state: winner.status,
    plan: 'solo',
    origin: winner.source,
    accessUntil: accessUntilForChain(
      winner.status,
      winner.periodEndsAt,
      winner.trialEndsAt,
      winner.graceEndsAt,
    ),
    trialEndsAt: winner.trialEndsAt ?? null,
    autoRenew: winner.autoRenew,
    managementTargets,
  }
}

/**
 * Garde serveur unique. Vérifie l’heure réelle — ne se fie pas seul au cache projection.
 */
export async function requirePro(
  ctx: DbCtx,
  userId: string,
  now = Date.now(),
): Promise<ProStatusView> {
  const status = await loadProStatusForUser(ctx, userId, now)
  if (!status.active) {
    throw new Error('PRO_REQUIRED')
  }
  if (status.accessUntil != null && status.accessUntil <= now) {
    throw new Error('PRO_EXPIRED')
  }
  return status
}

export async function hasActivePro(
  ctx: DbCtx,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const status = await loadProStatusForUser(ctx, userId, now)
  return status.active && (status.accessUntil == null || status.accessUntil > now)
}

export async function projectSubscriptionAccess(
  ctx: MutationCtx,
  userId: string,
  now = Date.now(),
): Promise<Id<'subscriptionAccess'>> {
  const status = await loadProStatusForUser(ctx, userId, now)
  const existing = await ctx.db
    .query('subscriptionAccess')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()

  const winner = status.active
    ? (
        await ctx.db
          .query('subscriptions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect()
      ).find((c) =>
        chainGrantsAccess(
          c.status,
          now,
          c.periodEndsAt,
          c.trialEndsAt,
          c.graceEndsAt,
          c.familyShared,
        ),
      )
    : null

  const nextTransitionAt = status.accessUntil ?? undefined
  const patch = {
    active: status.active,
    state: status.state,
    subscriptionId: winner?._id,
    plan: status.plan ?? undefined,
    origin: status.origin ?? undefined,
    accessUntil: status.accessUntil ?? undefined,
    trialEndsAt: status.trialEndsAt ?? undefined,
    autoRenew: status.autoRenew ?? undefined,
    nextTransitionAt,
    updatedAt: now,
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...patch,
      revision: existing.revision + 1,
    })
    return existing._id
  }

  return await ctx.db.insert('subscriptionAccess', {
    userId,
    ...patch,
    revision: 1,
  })
}
