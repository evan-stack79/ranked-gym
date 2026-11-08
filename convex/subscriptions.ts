/**
 * Ranked Pro Solo v0 — API Convex (ARCHI §4).
 * Aucune mutation publique n’accorde Pro sans preuve store vérifiée.
 * Interdit côté client : setPro / setProForTests (aucun export public de ce type).
 */
import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { requireSessionUser } from './lib/auth'
import {
  hasActivePro,
  loadProStatusForUser,
  projectSubscriptionAccess,
  requirePro,
} from './lib/subscriptionAccess'
import { applyVerifiedStateCore } from './lib/subscriptionApply'
import {
  normalizeAppleTransaction,
  parseLocalTestApplePayload,
  verifyAppleJwsSignature,
  type AppleRenewalClaims,
  type AppleTransactionClaims,
} from './lib/appleJws'
import { offerByKey } from './lib/subscriptionProducts'
import {
  PRO_CGV_VERSION,
  PRO_LEGAL_TEXT_VERSION_L05,
  PRO_LEGAL_TEXT_VERSION_L05B,
  PRO_MIN_AGE_YEARS,
} from '../shared/subscriptions/constants'
import { evaluatePurchaseAgeGate } from '../shared/subscriptions/age'
import { proL05bForOffer, PRO_CANCEL_LINK_LABEL } from '../shared/subscriptions/legalCopy'
import { scheduleTrialAndAnnualReminders, dueReminders } from './lib/subscriptionReminders'
import { PRO_OFFERS } from '../shared/subscriptions/constants'
import { fetchAppleSubscriptionStatus } from './lib/appleServerApi'
import {
  acknowledgeGoogleSubscription,
  fetchGoogleSubscriptionsv2,
  normalizeGoogleSubscriptionsv2,
} from './lib/googlePlayVerify'

const AGE_POLICY_VERSION = 'pro-min-15-civil-2026-11-08'

function randomUuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('CRYPTO_UNAVAILABLE')
  }
  c.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function ensureStoreAccount(
  ctx: { db: any },
  userId: string,
  now: number,
) {
  const existing = await ctx.db
    .query('subscriptionAccounts')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .first()
  if (existing) return existing
  const storeAccountToken = randomUuid()
  const collision = await ctx.db
    .query('subscriptionAccounts')
    .withIndex('by_store_token', (q: any) => q.eq('storeAccountToken', storeAccountToken))
    .first()
  if (collision) throw new Error('STORE_TOKEN_COLLISION')
  const id = await ctx.db.insert('subscriptionAccounts', {
    userId,
    storeAccountToken,
    createdAt: now,
  })
  return await ctx.db.get(id)
}

export const getProStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    return await loadProStatusForUser(ctx, user.userId)
  },
})

export const getSubscriptionProfile = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const profile = await ctx.db
      .query('subscriptionUserProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user.userId))
      .first()
    return {
      hasDateOfBirth: Boolean(profile?.dateOfBirth),
      dateOfBirth: profile?.dateOfBirth ?? null,
      minAgeYears: PRO_MIN_AGE_YEARS,
    }
  },
})

export const setDateOfBirth = mutation({
  args: {
    sessionToken: v.string(),
    dateOfBirth: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const gate = evaluatePurchaseAgeGate(args.dateOfBirth)
    if (!gate.ok && (gate.reason === 'invalid_dob' || gate.reason === 'future_dob')) {
      throw new Error('INVALID_DATE_OF_BIRTH')
    }
    const now = Date.now()
    const existing = await ctx.db
      .query('subscriptionUserProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user.userId))
      .first()
    if (existing) {
      if (existing.dateOfBirth && existing.dateOfBirth !== args.dateOfBirth) {
        throw new Error('DATE_OF_BIRTH_LOCKED')
      }
      await ctx.db.patch(existing._id, {
        dateOfBirth: args.dateOfBirth,
        dateOfBirthUpdatedAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('subscriptionUserProfiles', {
        userId: user.userId,
        dateOfBirth: args.dateOfBirth,
        dateOfBirthUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }
    return { ok: true as const, ageGate: gate }
  },
})

/**
 * Prépare un achat Solo — consentement PRO-L05 + garde 15 ans.
 * Alias Architecte : `recordPurchaseConsent` (appelée AVANT l'achat).
 * Ne donne JAMAIS Pro.
 */
export const preparePurchase = mutation({
  args: {
    sessionToken: v.string(),
    offerKey: v.union(v.literal('solo_monthly'), v.literal('solo_yearly')),
    withdrawalConsent: v.boolean(),
    legalVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (!args.withdrawalConsent) throw new Error('WITHDRAWAL_CONSENT_REQUIRED')
    if (args.legalVersion && args.legalVersion !== PRO_LEGAL_TEXT_VERSION_L05) {
      throw new Error('LEGAL_VERSION_MISMATCH')
    }

    const offer = offerByKey(args.offerKey)
    if (!offer) throw new Error('OFFER_NOT_ALLOWED')

    const profile = await ctx.db
      .query('subscriptionUserProfiles')
      .withIndex('by_user', (q) => q.eq('userId', user.userId))
      .first()
    const gate = evaluatePurchaseAgeGate(profile?.dateOfBirth)
    if (!gate.ok) {
      if (gate.reason === 'underage') throw new Error('UNDERAGE_PURCHASE_BLOCKED')
      throw new Error('DATE_OF_BIRTH_REQUIRED')
    }

    const now = Date.now()
    const account = await ensureStoreAccount(ctx, user.userId, now)

    const attemptId = await ctx.db.insert('subscriptionPurchaseAttempts', {
      userId: user.userId,
      offerKey: offer.key,
      productId: offer.productIdApple,
      billingPeriod: offer.billingPeriod,
      storeAccountToken: account.storeAccountToken,
      legalVersionL05: PRO_LEGAL_TEXT_VERSION_L05,
      legalVersionL05b: PRO_LEGAL_TEXT_VERSION_L05B,
      cgvVersion: PRO_CGV_VERSION,
      withdrawalConsentAt: now,
      ageGateYears: gate.ageYears,
      agePolicyVersion: AGE_POLICY_VERSION,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    })

    return {
      purchaseAttemptId: attemptId,
      storeAccountToken: account.storeAccountToken,
      offerKey: offer.key,
      productIdApple: offer.productIdApple,
      productIdGoogle: offer.productIdGoogle,
      basePlanIdGoogle: offer.basePlanIdGoogle,
      billingPeriod: offer.billingPeriod,
      legalCheckboxTextVersion: PRO_LEGAL_TEXT_VERSION_L05,
      legalAboveButton: proL05bForOffer(offer.key),
      grantsPro: false as const,
    }
  },
})

export const assertProForCosmetic = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    await requirePro(ctx, user.userId)
    return { ok: true as const }
  },
})

/**
 * Vérifie une preuve Apple (JWS StoreKit 2) puis applique l’état.
 * Pas de verifyReceipt legacy. Pas de grant avant vérif.
 */
export const verifyApplePurchase = mutation({
  args: {
    sessionToken: v.string(),
    signedTransaction: v.string(),
    signedRenewalInfo: v.optional(v.string()),
    purchaseAttemptId: v.optional(v.id('subscriptionPurchaseAttempts')),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)

    let claims: AppleTransactionClaims
    let renewal: AppleRenewalClaims | null = null

    const local = parseLocalTestApplePayload(args.signedTransaction)
    if (local) {
      claims = local
    } else {
      const verified = await verifyAppleJwsSignature(args.signedTransaction)
      claims = verified.payload as AppleTransactionClaims
      if (args.signedRenewalInfo) {
        const ren = await verifyAppleJwsSignature(args.signedRenewalInfo)
        renewal = ren.payload as AppleRenewalClaims
      }
      // Relecture App Store Server API quand les credentials sont configurés (ARCHI §5.1).
      if (claims.originalTransactionId) {
        const env =
          (claims.environment ?? '').toLowerCase() === 'sandbox' ||
          (claims.environment ?? '').toLowerCase() === 'xcode'
            ? 'sandbox'
            : 'production'
        try {
          const snap = await fetchAppleSubscriptionStatus(claims.originalTransactionId, env)
          if (snap?.signedTransactionInfo) {
            const re = await verifyAppleJwsSignature(snap.signedTransactionInfo)
            claims = re.payload as AppleTransactionClaims
          }
          if (snap?.signedRenewalInfo) {
            const ren = await verifyAppleJwsSignature(snap.signedRenewalInfo)
            renewal = ren.payload as AppleRenewalClaims
          }
        } catch (err) {
          // Credentials absents → null ; HTTP erreur → refuse (pas de grant sur JWS stale seul si API configurée).
          if (err instanceof Error && err.message.startsWith('APPLE_SERVER_API_')) {
            throw err
          }
        }
      }
    }

    const normalized = normalizeAppleTransaction({
      claims,
      renewal,
      expectedBundleId: process.env.APPLE_BUNDLE_ID,
    })
    if (local) {
      ;(normalized as { environment: string }).environment = 'local_test'
    }

    if (normalized.appAccountToken) {
      const account = await ctx.db
        .query('subscriptionAccounts')
        .withIndex('by_store_token', (q) =>
          q.eq('storeAccountToken', normalized.appAccountToken!),
        )
        .first()
      if (account && account.userId !== user.userId) {
        throw new Error('APP_ACCOUNT_TOKEN_MISMATCH')
      }
    }

    if (args.purchaseAttemptId) {
      const attempt = await ctx.db.get(args.purchaseAttemptId)
      if (!attempt || attempt.userId !== user.userId) {
        throw new Error('ATTEMPT_NOT_FOUND')
      }
      await ctx.db.patch(args.purchaseAttemptId, {
        status: 'submitted',
        updatedAt: Date.now(),
      })
    }

    const applied = await applyVerifiedStateCore(ctx, {
      userId: user.userId,
      source: 'apple',
      environment: local ? 'local_test' : normalized.environment,
      storeChainKey: normalized.storeChainKey,
      latestTransactionId: normalized.latestTransactionId,
      productId: normalized.productId,
      billingPeriod: normalized.billingPeriod,
      status: normalized.status,
      periodEndsAt: normalized.periodEndsAt,
      trialEndsAt: normalized.trialEndsAt,
      graceEndsAt: normalized.graceEndsAt,
      autoRenew: normalized.autoRenew,
      isTrial: normalized.isTrial,
      billingRetry: normalized.billingRetry,
      familyShared: normalized.familyShared,
      revokedAt: normalized.revokedAt,
      refundedAt: normalized.refundedAt,
      actor: 'verifyApplePurchase',
      eventKey: `apple:tx:${normalized.latestTransactionId}`,
      eventType: 'purchase_verify',
      payloadHash: `apple:${normalized.storeChainKey}:${normalized.latestTransactionId}`,
    })

    let withdrawalConsentAt = Date.now()
    let offerKey = normalized.billingPeriod === 'year' ? 'solo_yearly' : 'solo_monthly'
    let legalVersionL05 = PRO_LEGAL_TEXT_VERSION_L05
    if (args.purchaseAttemptId) {
      const attempt = await ctx.db.get(args.purchaseAttemptId)
      await ctx.db.patch(args.purchaseAttemptId, {
        status: 'verified',
        updatedAt: Date.now(),
      })
      if (attempt) {
        withdrawalConsentAt = attempt.withdrawalConsentAt
        offerKey = attempt.offerKey as 'solo_monthly' | 'solo_yearly'
        legalVersionL05 = attempt.legalVersionL05
      }
    }

    await scheduleTrialAndAnnualReminders(ctx, {
      userId: user.userId,
      storeChainKey: normalized.storeChainKey,
      billingPeriod: normalized.billingPeriod,
      trialEndsAt: normalized.trialEndsAt,
      periodEndsAt: normalized.periodEndsAt,
      isTrial: normalized.isTrial,
    })

    const priceDisplay =
      offerKey === 'solo_yearly'
        ? PRO_OFFERS.yearly.priceEurosDisplay + ' / an'
        : PRO_OFFERS.monthly.priceEurosDisplay + ' / mois'
    const receiptId = await ctx.db.insert('subscriptionReceipts', {
      userId: user.userId,
      subscriptionId: applied.subscriptionId,
      purchaseAttemptId: args.purchaseAttemptId,
      offerKey,
      productId: normalized.productId,
      priceDisplay,
      firstChargeAt: normalized.isTrial ? normalized.trialEndsAt : normalized.periodEndsAt,
      firstChargeAmountDisplay: priceDisplay,
      withdrawalConsentAt,
      legalVersionL05,
      cancelUrl: 'https://apps.apple.com/account/subscriptions',
      createdAt: Date.now(),
    })

    const status = await loadProStatusForUser(ctx, user.userId)
    return {
      ok: true as const,
      subscriptionId: applied.subscriptionId,
      revision: applied.revision,
      status,
      finishTransactionId: normalized.latestTransactionId,
      receiptId,
      cancelLinkLabel: PRO_CANCEL_LINK_LABEL,
    }
  },
})

/** Alias explicite brief Architecte — même handler que preparePurchase. */
export const recordPurchaseConsent = preparePurchase

/**
 * Google Play — structure v0. Sans credentials API : refuse (fail-closed).
 * Mode local_test : payload `localtest.{json}` comme Apple.
 */
export const verifyGooglePurchase = mutation({
  args: {
    sessionToken: v.string(),
    purchaseToken: v.string(),
    productId: v.string(),
    basePlanId: v.optional(v.string()),
    purchaseAttemptId: v.optional(v.id('subscriptionPurchaseAttempts')),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)

    if (args.purchaseToken.startsWith('localtest.')) {
      const deployEnv = (process.env.SUBSCRIPTION_DEPLOY_ENV ?? 'production').toLowerCase()
      if (deployEnv === 'production') {
        throw new Error('LOCAL_TEST_REJECTED_IN_PRODUCTION')
      }
      const claims = JSON.parse(args.purchaseToken.slice('localtest.'.length)) as {
        purchaseToken: string
        productId: string
        basePlanId?: string
        expiryTimeMillis?: number
        subscriptionState?: string
        obfuscatedExternalAccountId?: string
      }
      const productId = claims.productId || args.productId
      const { billingPeriodForGoogle, isAllowedGoogleProductId } = await import(
        './lib/subscriptionProducts'
      )
      if (!isAllowedGoogleProductId(productId)) throw new Error('GOOGLE_PRODUCT_NOT_ALLOWED')
      const billingPeriod = billingPeriodForGoogle(productId, claims.basePlanId ?? args.basePlanId)
      if (!billingPeriod) throw new Error('GOOGLE_PRODUCT_NOT_ALLOWED')

      // Liaison compte : obfuscated id doit matcher storeAccountToken si fourni.
      if (claims.obfuscatedExternalAccountId) {
        const account = await ctx.db
          .query('subscriptionAccounts')
          .withIndex('by_store_token', (q) =>
            q.eq('storeAccountToken', claims.obfuscatedExternalAccountId!),
          )
          .first()
        if (account && account.userId !== user.userId) {
          throw new Error('GOOGLE_ACCOUNT_TOKEN_MISMATCH')
        }
      }

      const periodEndsAt = claims.expiryTimeMillis ?? Date.now() + 14 * 86400000
      const applied = await applyVerifiedStateCore(ctx, {
        userId: user.userId,
        source: 'google',
        environment: 'local_test',
        storeChainKey: claims.purchaseToken || args.purchaseToken,
        productId,
        basePlanId: claims.basePlanId ?? args.basePlanId,
        billingPeriod,
        status: 'trial',
        periodEndsAt,
        trialEndsAt: periodEndsAt,
        autoRenew: true,
        isTrial: true,
        billingRetry: false,
        actor: 'verifyGooglePurchase:localtest',
        eventKey: `google:local:${claims.purchaseToken || args.purchaseToken}`,
        eventType: 'purchase_verify',
        payloadHash: `google:local:${productId}`,
      })
      return {
        ok: true as const,
        subscriptionId: applied.subscriptionId,
        revision: applied.revision,
        status: await loadProStatusForUser(ctx, user.userId),
      }
    }

    const apiBody = await fetchGoogleSubscriptionsv2(args.purchaseToken)
    if (!apiBody) {
      throw new Error('GOOGLE_PLAY_NOT_CONFIGURED')
    }
    const normalized = normalizeGoogleSubscriptionsv2({
      purchaseToken: args.purchaseToken,
      body: apiBody,
    })
    if (normalized.environment === 'sandbox') {
      const deployEnv = (process.env.SUBSCRIPTION_DEPLOY_ENV ?? 'production').toLowerCase()
      if (deployEnv === 'production') throw new Error('SANDBOX_REJECTED_IN_PRODUCTION')
    }
    if (normalized.obfuscatedExternalAccountId) {
      const account = await ctx.db
        .query('subscriptionAccounts')
        .withIndex('by_store_token', (q) =>
          q.eq('storeAccountToken', normalized.obfuscatedExternalAccountId!),
        )
        .first()
      if (account && account.userId !== user.userId) {
        throw new Error('GOOGLE_ACCOUNT_TOKEN_MISMATCH')
      }
    }

    const applied = await applyVerifiedStateCore(ctx, {
      userId: user.userId,
      source: 'google',
      environment: normalized.environment,
      storeChainKey: normalized.storeChainKey,
      productId: normalized.productId,
      basePlanId: normalized.basePlanId,
      billingPeriod: normalized.billingPeriod,
      status: normalized.status,
      periodEndsAt: normalized.periodEndsAt,
      trialEndsAt: normalized.trialEndsAt,
      graceEndsAt: normalized.graceEndsAt,
      autoRenew: normalized.autoRenew,
      isTrial: normalized.isTrial,
      billingRetry: normalized.billingRetry,
      linkedChainKey: normalized.linkedChainKey,
      purchaseTokenEncrypted: args.purchaseToken,
      actor: 'verifyGooglePurchase',
      eventKey: `google:token:${normalized.storeChainKey.slice(0, 64)}`,
      eventType: 'purchase_verify',
      payloadHash: `google:${normalized.productId}:${normalized.storeChainKey.slice(0, 32)}`,
    })

    try {
      await acknowledgeGoogleSubscription({
        purchaseToken: args.purchaseToken,
        subscriptionId: normalized.productId,
      })
    } catch {
      // Acknowledge repris par reconcile — ne pas retirer un droit déjà vérifié.
    }

    await scheduleTrialAndAnnualReminders(ctx, {
      userId: user.userId,
      storeChainKey: normalized.storeChainKey,
      billingPeriod: normalized.billingPeriod,
      trialEndsAt: normalized.trialEndsAt,
      periodEndsAt: normalized.periodEndsAt,
      isTrial: normalized.isTrial,
    })

    return {
      ok: true as const,
      subscriptionId: applied.subscriptionId,
      revision: applied.revision,
      status: await loadProStatusForUser(ctx, user.userId),
    }
  },
})

export const applyVerifiedState = internalMutation({
  args: {
    userId: v.string(),
    source: v.union(v.literal('apple'), v.literal('google'), v.literal('admin')),
    environment: v.union(
      v.literal('production'),
      v.literal('sandbox'),
      v.literal('local_test'),
    ),
    storeChainKey: v.string(),
    latestTransactionId: v.optional(v.string()),
    productId: v.string(),
    basePlanId: v.optional(v.string()),
    offerId: v.optional(v.string()),
    billingPeriod: v.union(v.literal('month'), v.literal('year')),
    status: v.union(
      v.literal('pending'),
      v.literal('trial'),
      v.literal('active'),
      v.literal('canceled_active_until'),
      v.literal('grace'),
      v.literal('suspended'),
      v.literal('expired'),
      v.literal('refunded'),
      v.literal('revoked'),
    ),
    periodEndsAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    graceEndsAt: v.optional(v.number()),
    autoRenew: v.boolean(),
    isTrial: v.boolean(),
    billingRetry: v.boolean(),
    familyShared: v.optional(v.boolean()),
    revokedAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
    purchaseTokenEncrypted: v.optional(v.string()),
    linkedChainKey: v.optional(v.string()),
    expectedRevision: v.optional(v.number()),
    actor: v.string(),
    eventKey: v.optional(v.string()),
    eventType: v.optional(v.string()),
    payloadHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => applyVerifiedStateCore(ctx, args),
})

export const adminAdjust = internalMutation({
  args: {
    userId: v.string(),
    activeUntil: v.number(),
    reason: v.string(),
    adminActorId: v.string(),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.MIGRATION_ADMIN_SECRET
    if (!expected || args.adminSecret !== expected) {
      throw new Error('ADMIN_FORBIDDEN')
    }
    if (!args.reason.trim()) throw new Error('ADMIN_REASON_REQUIRED')
    const now = Date.now()
    return await applyVerifiedStateCore(ctx, {
      userId: args.userId,
      source: 'admin',
      environment: 'production',
      storeChainKey: `admin:${args.userId}`,
      productId: 'ranked.pro.solo.admin',
      billingPeriod: 'month',
      status: args.activeUntil > now ? 'active' : 'expired',
      periodEndsAt: args.activeUntil,
      autoRenew: false,
      isTrial: false,
      billingRetry: false,
      actor: `admin:${args.adminActorId}`,
      eventType: 'admin_adjust',
      payloadHash: `admin:${args.userId}:${args.activeUntil}:${args.reason}`,
    })
  },
})

/**
 * Grant de test interne uniquement (SUBSCRIPTION_DEPLOY_ENV ≠ production).
 * Équivalent aligné avec `setProForTests` internalMutation de PR #142 —
 * jamais exporté en `mutation` publique.
 */
export const grantLocalTestPro = internalMutation({
  args: {
    userId: v.string(),
    activeUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const deployEnv = (process.env.SUBSCRIPTION_DEPLOY_ENV ?? 'production').toLowerCase()
    if (deployEnv === 'production') {
      throw new Error('LOCAL_TEST_GRANT_FORBIDDEN_IN_PRODUCTION')
    }
    const now = Date.now()
    return await applyVerifiedStateCore(ctx, {
      userId: args.userId,
      source: 'apple',
      environment: 'local_test',
      storeChainKey: `localtest:${args.userId}`,
      latestTransactionId: `localtest-tx-${now}`,
      productId: 'ranked.pro.solo.monthly',
      billingPeriod: 'month',
      status: args.activeUntil > now ? 'trial' : 'expired',
      periodEndsAt: args.activeUntil,
      trialEndsAt: args.activeUntil,
      autoRenew: true,
      isTrial: true,
      billingRetry: false,
      actor: 'grantLocalTestPro',
      eventType: 'local_test_grant',
      payloadHash: `localtest:${args.userId}:${args.activeUntil}`,
    })
  },
})

export const ingestAppleNotification = internalMutation({
  args: {
    environment: v.string(),
    notificationUUID: v.string(),
    notificationType: v.string(),
    payloadHash: v.string(),
    payloadEncrypted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptionEvents')
      .withIndex('by_source_env_event', (q) =>
        q
          .eq('source', 'apple')
          .eq('environment', args.environment)
          .eq('eventKey', args.notificationUUID),
      )
      .first()
    if (existing) return { duplicate: true as const, eventId: existing._id }
    const eventId = await ctx.db.insert('subscriptionEvents', {
      source: 'apple',
      environment: args.environment,
      eventKey: args.notificationUUID,
      type: args.notificationType,
      receivedAt: Date.now(),
      payloadHash: args.payloadHash,
      payloadEncrypted: args.payloadEncrypted,
      processingState: 'queued',
      attempts: 0,
      actor: 'apple_asn_v2',
    })
    return { duplicate: false as const, eventId }
  },
})

export const ingestGoogleRtdn = internalMutation({
  args: {
    environment: v.string(),
    messageId: v.string(),
    notificationType: v.string(),
    payloadHash: v.string(),
  },
  handler: async (ctx, args) => {
    const eventKey = `pubsub:${args.messageId}`
    const existing = await ctx.db
      .query('subscriptionEvents')
      .withIndex('by_source_env_event', (q) =>
        q.eq('source', 'google').eq('environment', args.environment).eq('eventKey', eventKey),
      )
      .first()
    if (existing) return { duplicate: true as const, eventId: existing._id }
    const eventId = await ctx.db.insert('subscriptionEvents', {
      source: 'google',
      environment: args.environment,
      eventKey,
      type: args.notificationType,
      receivedAt: Date.now(),
      payloadHash: args.payloadHash,
      processingState: 'queued',
      attempts: 0,
      actor: 'google_rtdn',
    })
    return { duplicate: false as const, eventId }
  },
})

export const applyDeadline = internalMutation({
  args: {
    userId: v.string(),
    expectedRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query('subscriptionAccess')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()
    if (
      access &&
      typeof args.expectedRevision === 'number' &&
      access.revision !== args.expectedRevision
    ) {
      return { skipped: true as const, reason: 'revision_mismatch' }
    }
    await projectSubscriptionAccess(ctx, args.userId)
    return { skipped: false as const }
  },
})

export const getProStatusInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => loadProStatusForUser(ctx, args.userId),
})

export const getLatestReceipt = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const rows = await ctx.db
      .query('subscriptionReceipts')
      .withIndex('by_user', (q) => q.eq('userId', user.userId))
      .collect()
    rows.sort((a, b) => b.createdAt - a.createdAt)
    const latest = rows[0]
    if (!latest) return null
    return {
      receiptId: latest._id,
      offerKey: latest.offerKey,
      productId: latest.productId,
      priceDisplay: latest.priceDisplay,
      firstChargeAt: latest.firstChargeAt ?? null,
      firstChargeAmountDisplay: latest.firstChargeAmountDisplay,
      withdrawalConsentAt: latest.withdrawalConsentAt,
      legalVersionL05: latest.legalVersionL05,
      cancelUrl: latest.cancelUrl,
      createdAt: latest.createdAt,
    }
  },
})

/** Cron / outbox : marque dus les rappels (email réel = hors scope sans RESEND). */
export const processReminderOutbox = internalMutation({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const due = await dueReminders(ctx, now, args.limit ?? 50)
    let sent = 0
    for (const row of due) {
      // Canal email : nécessite RESEND — on journalise "sent" côté outbox pour dédup ;
      // le contenu mail reste à brancher quand le vendeur est prêt (pas de secret ici).
      await ctx.db.patch(row._id, {
        status: 'sent',
        sentAt: now,
        updatedAt: now,
      })
      sent += 1
    }
    return { scanned: due.length, sent }
  },
})

/**
 * Migration post-#142 : ne JAMAIS promouvoir `proEntitlements.activeUntil` en droit payant.
 * Sans table legacy sur ce branch (main) → no-op. Après merge #142, inventorie puis
 * exige une preuve store revalidée ou adminAdjust tracé.
 */
export const migrateLegacyProEntitlements = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Table absente sur main : lecture défensive via any.
    let legacy: Array<{ userId: string; activeUntil: number }> = []
    try {
      legacy = (await (ctx.db as any).query('proEntitlements').collect()) as Array<{
        userId: string
        activeUntil: number
      }>
    } catch {
      return { migrated: 0, skipped: 0, reason: 'proEntitlements_absent' as const }
    }
    let skipped = 0
    for (const row of legacy) {
      skipped += 1
      // Explicit: do not call applyVerifiedStateCore from activeUntil alone.
      void row.userId
      void row.activeUntil
      void args.dryRun
    }
    return {
      migrated: 0,
      skipped,
      reason: 'no_blind_promote' as const,
    }
  },
})

export { requirePro, hasActivePro }
