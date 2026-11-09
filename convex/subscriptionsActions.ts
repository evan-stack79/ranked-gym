/**
 * Actions Ranked Pro — fetch réseau + vérif crypto Node (QA M1 / B1).
 * Les écritures DB passent par mutations internes (finalize* / applyQueued*).
 */
'use node'

import { v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { api, internal } from './_generated/api'
import {
  decodeJwsPayloadUnsafe,
  type AppleRenewalClaims,
  type AppleTransactionClaims,
} from './lib/appleJws'
import { verifyAppleJwsSignature } from './lib/appleJwsVerify'
import { fetchAppleSubscriptionStatus } from './lib/appleServerApi'
import {
  acknowledgeGoogleSubscription,
  fetchGoogleSubscriptionsv2,
} from './lib/googlePlayVerify'
import { readSubscriptionEnv } from './lib/subscriptionEnv'
import { verifyGoogleRtdnOidc } from './lib/googleRtdnAuth'

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(16)}`
}

export const verifyApplePurchase = action({
  args: {
    sessionToken: v.string(),
    signedTransaction: v.string(),
    signedRenewalInfo: v.optional(v.string()),
    purchaseAttemptId: v.optional(v.id('subscriptionPurchaseAttempts')),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const session = await ctx.runQuery(internal.subscriptions.resolveSessionUserId, {
      sessionToken: args.sessionToken,
    })
    const userId = session.userId as string

    // QA m3 — JWS Apple signé obligatoire (aucun fallback non signé).
    const verified = await verifyAppleJwsSignature(args.signedTransaction)
    let claims = verified.payload as AppleTransactionClaims
    let renewal: AppleRenewalClaims | null = null
    if (args.signedRenewalInfo) {
      const ren = await verifyAppleJwsSignature(args.signedRenewalInfo)
      renewal = ren.payload as AppleRenewalClaims
    }
    if (claims.originalTransactionId) {
      const env =
        (claims.environment ?? '').toLowerCase() === 'sandbox' ||
        (claims.environment ?? '').toLowerCase() === 'xcode'
          ? 'sandbox'
          : 'production'
      const snap = await fetchAppleSubscriptionStatus(claims.originalTransactionId, env)
      if (snap?.signedTransactionInfo) {
        const re = await verifyAppleJwsSignature(snap.signedTransactionInfo)
        claims = re.payload as AppleTransactionClaims
      }
      if (snap?.signedRenewalInfo) {
        const ren = await verifyAppleJwsSignature(snap.signedRenewalInfo)
        renewal = ren.payload as AppleRenewalClaims
      }
    }

    return await ctx.runMutation(internal.subscriptions.finalizeApplePurchase, {
      userId,
      claims,
      renewal: renewal ?? undefined,
      purchaseAttemptId: args.purchaseAttemptId,
      actor: 'verifyApplePurchase',
    })
  },
})

export const verifyGooglePurchase = action({
  args: {
    sessionToken: v.string(),
    purchaseToken: v.string(),
    productId: v.string(),
    basePlanId: v.optional(v.string()),
    purchaseAttemptId: v.optional(v.id('subscriptionPurchaseAttempts')),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const session = await ctx.runQuery(internal.subscriptions.resolveSessionUserId, {
      sessionToken: args.sessionToken,
    })
    const userId = session.userId as string

    if (args.purchaseToken.startsWith('localtest.')) {
      const deployEnv = (readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production').toLowerCase()
      if (deployEnv === 'production') {
        throw new Error('LOCAL_TEST_REJECTED_IN_PRODUCTION')
      }
      const claims = JSON.parse(args.purchaseToken.slice('localtest.'.length))
      return await ctx.runMutation(internal.subscriptions.finalizeGooglePurchase, {
        userId,
        purchaseToken: args.purchaseToken,
        productId: args.productId,
        basePlanId: args.basePlanId,
        localClaims: claims,
        purchaseAttemptId: args.purchaseAttemptId,
        actor: 'verifyGooglePurchase:localtest',
      })
    }

    const apiBody = await fetchGoogleSubscriptionsv2(args.purchaseToken)
    if (!apiBody) throw new Error('GOOGLE_PLAY_NOT_CONFIGURED')

    const result = await ctx.runMutation(internal.subscriptions.finalizeGooglePurchase, {
      userId,
      purchaseToken: args.purchaseToken,
      productId: args.productId,
      basePlanId: args.basePlanId,
      apiBody,
      purchaseAttemptId: args.purchaseAttemptId,
      actor: 'verifyGooglePurchase',
    })

    if (result.shouldAcknowledge) {
      try {
        await acknowledgeGoogleSubscription({
          purchaseToken: args.purchaseToken,
          subscriptionId: result.acknowledgeProductId,
        })
      } catch {
        // Acknowledge repris plus tard — droit déjà vérifié.
      }
    }

    return {
      ok: result.ok,
      subscriptionId: result.subscriptionId,
      revision: result.revision,
      status: result.status,
    }
  },
})

/**
 * Ingère + traite immédiatement une ASN V2 (idempotent).
 */
export const ingestAndProcessAppleNotification = internalAction({
  args: {
    signedPayload: v.string(),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    await verifyAppleJwsSignature(args.signedPayload)
    const outer = decodeJwsPayloadUnsafe(args.signedPayload) as {
      notificationType?: string
      notificationUUID?: string
      data?: {
        environment?: string
        signedTransactionInfo?: string
        signedRenewalInfo?: string
      }
    }
    if (!outer.notificationUUID) throw new Error('missing_notification_uuid')
    const environment = (outer.data?.environment ?? 'Production').toLowerCase()
    const signedTx = outer.data?.signedTransactionInfo
    const signedRenewal = outer.data?.signedRenewalInfo

    const ingested = await ctx.runMutation(internal.subscriptions.ingestAppleNotification, {
      environment,
      notificationUUID: outer.notificationUUID,
      notificationType: outer.notificationType ?? 'UNKNOWN',
      payloadHash: simpleHash(args.signedPayload),
      payloadEncrypted: signedTx,
      signedRenewalInfo: signedRenewal,
    })

    if (ingested.processingState === 'applied') {
      return { ok: true as const, duplicate: true as const, eventId: ingested.eventId }
    }
    if (!signedTx) {
      return { ok: true as const, queued: true as const, eventId: ingested.eventId }
    }

    try {
      // QA m3 — ASN V2 : JWS signé uniquement.
      const verified = await verifyAppleJwsSignature(signedTx)
      const claims = verified.payload as AppleTransactionClaims
      let renewal: AppleRenewalClaims | null = null
      if (signedRenewal) {
        const ren = await verifyAppleJwsSignature(signedRenewal)
        renewal = ren.payload as AppleRenewalClaims
      }
      return await ctx.runMutation(internal.subscriptions.applyQueuedAppleNotification, {
        eventId: ingested.eventId,
        claims,
        renewal: renewal ?? undefined,
      })
    } catch (err) {
      await ctx.runMutation(internal.subscriptions.markSubscriptionEventFailed, {
        eventId: ingested.eventId,
        lastError: err instanceof Error ? err.message : 'apply_failed',
      })
      throw err
    }
  },
})

export const ingestAndProcessGoogleRtdn = internalAction({
  args: {
    environment: v.string(),
    messageId: v.string(),
    notificationType: v.string(),
    dataB64: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    let decoded: string | undefined
    let purchaseToken: string | undefined
    let notifType = args.notificationType
    if (args.dataB64) {
      const pad =
        args.dataB64.length % 4 === 0 ? '' : '='.repeat(4 - (args.dataB64.length % 4))
      const b64 = (args.dataB64 + pad).replace(/-/g, '+').replace(/_/g, '/')
      decoded = atob(b64)
      try {
        const parsed = JSON.parse(decoded) as {
          subscriptionNotification?: {
            notificationType?: number
            purchaseToken?: string
            subscriptionId?: string
          }
        }
        const sn = parsed.subscriptionNotification
        if (sn?.notificationType != null) notifType = String(sn.notificationType)
        purchaseToken = sn?.purchaseToken
      } catch {
        // keep raw
      }
    }

    const ingested = await ctx.runMutation(internal.subscriptions.ingestGoogleRtdn, {
      environment: args.environment,
      messageId: args.messageId,
      notificationType: notifType,
      payloadHash: simpleHash(decoded ?? args.messageId),
      payloadEncrypted: decoded,
    })
    if (ingested.processingState === 'applied') {
      return { ok: true as const, duplicate: true as const, eventId: ingested.eventId }
    }
    if (!purchaseToken) {
      return { ok: true as const, queued: true as const, eventId: ingested.eventId }
    }

    try {
      const apiBody = await fetchGoogleSubscriptionsv2(purchaseToken)
      if (!apiBody) {
        await ctx.runMutation(internal.subscriptions.markSubscriptionEventFailed, {
          eventId: ingested.eventId,
          lastError: 'GOOGLE_PLAY_NOT_CONFIGURED',
        })
        return { ok: false as const, reason: 'not_configured' as const }
      }
      return await ctx.runMutation(internal.subscriptions.applyQueuedGoogleNotification, {
        eventId: ingested.eventId,
        purchaseToken,
        apiBody,
      })
    } catch (err) {
      await ctx.runMutation(internal.subscriptions.markSubscriptionEventFailed, {
        eventId: ingested.eventId,
        lastError: err instanceof Error ? err.message : 'apply_failed',
      })
      throw err
    }
  },
})

/** Cron : traite la file ASN/RTDN restante (idempotent). */
export const processQueuedSubscriptionEvents = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ scanned: number; applied: number; failed: number }> => {
    const rows = (await ctx.runQuery(internal.subscriptions.listQueuedSubscriptionEvents, {
      limit: args.limit ?? 20,
    })) as Array<{
      _id: any
      source: string
      payloadEncrypted?: string
      after?: string
    }>
    let applied = 0
    let failed = 0
    for (const row of rows) {
      try {
        if (row.source === 'apple' && row.payloadEncrypted) {
          const verified = await verifyAppleJwsSignature(row.payloadEncrypted)
          const claims = verified.payload as AppleTransactionClaims
          let renewal: AppleRenewalClaims | null = null
          if (row.after) {
            const ren = await verifyAppleJwsSignature(row.after)
            renewal = ren.payload as AppleRenewalClaims
          }
          await ctx.runMutation(internal.subscriptions.applyQueuedAppleNotification, {
            eventId: row._id,
            claims,
            renewal: renewal ?? undefined,
          })
          applied += 1
        } else if (row.source === 'google' && row.payloadEncrypted) {
          const parsed = JSON.parse(row.payloadEncrypted) as {
            subscriptionNotification?: { purchaseToken?: string }
          }
          const token = parsed.subscriptionNotification?.purchaseToken
          if (!token) continue
          const apiBody = await fetchGoogleSubscriptionsv2(token)
          if (!apiBody) continue
          await ctx.runMutation(internal.subscriptions.applyQueuedGoogleNotification, {
            eventId: row._id,
            purchaseToken: token,
            apiBody,
          })
          applied += 1
        }
      } catch (err) {
        failed += 1
        await ctx.runMutation(internal.subscriptions.markSubscriptionEventFailed, {
          eventId: row._id,
          lastError: err instanceof Error ? err.message : 'process_failed',
        })
      }
    }
    return { scanned: rows.length, applied, failed }
  },
})

/** OIDC Pub/Sub — appelé depuis httpAction (QA m1). */
export const verifyRtdnBearerForHttp = internalAction({
  args: {
    bearerToken: v.string(),
    audience: v.string(),
    expectedEmail: v.string(),
  },
  handler: async (_ctx, args) => {
    return await verifyGoogleRtdnOidc(args)
  },
})

// Keep api import used for http typing side-effects in generated bundle.
void api
