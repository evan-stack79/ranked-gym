/**
 * Application idempotente d’un état store vérifié (ARCHI §5.1 / §5.4).
 * Appelé uniquement après validation crypto / API — jamais depuis un flag client.
 */
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import {
  PRO_FAMILY_SHARING_ENABLED,
  PRO_PLAN,
  PRO_SEAT_LIMIT,
  type SubscriptionChainStatus,
  type SubscriptionEnvironment,
  type SubscriptionSource,
} from '../../shared/subscriptions/constants'
import { readSubscriptionEnv } from './subscriptionEnv'
import { projectSubscriptionAccess } from './subscriptionAccess'
import { assertSoloProductId } from './subscriptionProducts'

export type VerifiedSubscriptionState = {
  userId: string
  source: SubscriptionSource
  environment: SubscriptionEnvironment
  storeChainKey: string
  latestTransactionId?: string
  productId: string
  basePlanId?: string
  offerId?: string
  billingPeriod: 'month' | 'year'
  status: SubscriptionChainStatus
  periodEndsAt?: number
  trialEndsAt?: number
  graceEndsAt?: number
  autoRenew: boolean
  isTrial: boolean
  billingRetry: boolean
  familyShared?: boolean
  revokedAt?: number
  refundedAt?: number
  purchaseTokenEncrypted?: string
  linkedChainKey?: string
  expectedRevision?: number
  actor: string
  eventKey?: string
  eventType?: string
  payloadHash?: string
}

function shaPreview(s: string): string {
  // Lightweight non-crypto fingerprint for audit summaries (not a security hash).
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(16)}`
}

export async function applyVerifiedStateCore(
  ctx: MutationCtx,
  input: VerifiedSubscriptionState,
  now = Date.now(),
): Promise<{ subscriptionId: Id<'subscriptions'>; revision: number }> {
  assertSoloProductId(input.productId)

  if (!PRO_FAMILY_SHARING_ENABLED && input.familyShared === true) {
    throw new Error('FAMILY_SHARING_DISABLED')
  }

  if (input.environment === 'sandbox' || input.environment === 'local_test') {
    const deployEnv = (readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production').toLowerCase()
    if (deployEnv === 'production' && input.environment !== 'local_test') {
      // Production deployment must refuse sandbox proofs.
      // local_test only allowed when SUBSCRIPTION_DEPLOY_ENV=test|local
      throw new Error('SANDBOX_REJECTED_IN_PRODUCTION')
    }
    if (input.environment === 'local_test' && deployEnv === 'production') {
      throw new Error('LOCAL_TEST_REJECTED_IN_PRODUCTION')
    }
  }

  const existing = await ctx.db
    .query('subscriptions')
    .withIndex('by_source_env_chain', (q) =>
      q
        .eq('source', input.source)
        .eq('environment', input.environment)
        .eq('storeChainKey', input.storeChainKey),
    )
    .first()

  if (existing && existing.userId !== input.userId) {
    throw new Error('CHAIN_OWNED_BY_OTHER_USER')
  }

  if (
    existing &&
    typeof input.expectedRevision === 'number' &&
    existing.revision !== input.expectedRevision
  ) {
    throw new Error('REVISION_CONFLICT')
  }

  const before = existing
    ? JSON.stringify({
        status: existing.status,
        periodEndsAt: existing.periodEndsAt,
        revision: existing.revision,
      })
    : undefined

  let subscriptionId: Id<'subscriptions'>
  let revision: number

  if (existing) {
    revision = existing.revision + 1
    await ctx.db.patch(existing._id, {
      latestTransactionId: input.latestTransactionId,
      productId: input.productId,
      basePlanId: input.basePlanId,
      offerId: input.offerId,
      billingPeriod: input.billingPeriod,
      status: input.status,
      periodEndsAt: input.periodEndsAt,
      trialEndsAt: input.trialEndsAt,
      graceEndsAt: input.graceEndsAt,
      autoRenew: input.autoRenew,
      isTrial: input.isTrial,
      billingRetry: input.billingRetry,
      familyShared: input.familyShared,
      revokedAt: input.revokedAt,
      refundedAt: input.refundedAt,
      purchaseTokenEncrypted: input.purchaseTokenEncrypted,
      linkedChainKey: input.linkedChainKey,
      verifiedAt: now,
      updatedAt: now,
      revision,
      plan: PRO_PLAN,
      seatLimit: PRO_SEAT_LIMIT,
    })
    subscriptionId = existing._id
  } else {
    revision = 1
    subscriptionId = await ctx.db.insert('subscriptions', {
      userId: input.userId,
      source: input.source,
      environment: input.environment,
      storeChainKey: input.storeChainKey,
      latestTransactionId: input.latestTransactionId,
      productId: input.productId,
      basePlanId: input.basePlanId,
      offerId: input.offerId,
      plan: PRO_PLAN,
      seatLimit: PRO_SEAT_LIMIT,
      billingPeriod: input.billingPeriod,
      status: input.status,
      periodEndsAt: input.periodEndsAt,
      trialEndsAt: input.trialEndsAt,
      graceEndsAt: input.graceEndsAt,
      autoRenew: input.autoRenew,
      isTrial: input.isTrial,
      billingRetry: input.billingRetry,
      familyShared: input.familyShared,
      revokedAt: input.revokedAt,
      refundedAt: input.refundedAt,
      purchaseTokenEncrypted: input.purchaseTokenEncrypted,
      linkedChainKey: input.linkedChainKey,
      verifiedAt: now,
      updatedAt: now,
      revision,
    })
  }

  await projectSubscriptionAccess(ctx, input.userId, now)

  if (input.eventKey && input.payloadHash) {
    const prior = await ctx.db
      .query('subscriptionEvents')
      .withIndex('by_source_env_event', (q) =>
        q
          .eq('source', input.source)
          .eq('environment', input.environment)
          .eq('eventKey', input.eventKey!),
      )
      .first()
    if (!prior) {
      await ctx.db.insert('subscriptionEvents', {
        source: input.source,
        environment: input.environment,
        eventKey: input.eventKey,
        subscriptionId,
        userId: input.userId,
        type: input.eventType ?? 'verified_state',
        receivedAt: now,
        payloadHash: input.payloadHash,
        processingState: 'applied',
        attempts: 1,
        actor: input.actor,
        before,
        after: JSON.stringify({
          status: input.status,
          periodEndsAt: input.periodEndsAt,
          revision,
        }),
        appliedAt: now,
      })
    } else if (prior.processingState !== 'applied') {
      await ctx.db.patch(prior._id, {
        processingState: 'applied',
        subscriptionId,
        userId: input.userId,
        appliedAt: now,
        after: JSON.stringify({ status: input.status, revision }),
        attempts: prior.attempts + 1,
      })
    }
  } else {
    await ctx.db.insert('subscriptionEvents', {
      source: input.source,
      environment: input.environment,
      eventKey: `apply:${input.storeChainKey}:${revision}:${shaPreview(input.actor)}`,
      subscriptionId,
      userId: input.userId,
      type: input.eventType ?? 'verified_state',
      receivedAt: now,
      payloadHash: input.payloadHash ?? shaPreview(JSON.stringify(input)),
      processingState: 'applied',
      attempts: 1,
      actor: input.actor,
      before,
      after: JSON.stringify({ status: input.status, revision }),
      appliedAt: now,
    })
  }

  return { subscriptionId, revision }
}
