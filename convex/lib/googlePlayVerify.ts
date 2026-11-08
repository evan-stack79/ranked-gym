/**
 * Google Play Billing — purchases.subscriptionsv2 + acknowledge (ARCHI §5.1 / AB-d).
 * Sans credentials : null (fail-closed en prod côté mutation).
 */
import {
  billingPeriodForGoogle,
  isAllowedGoogleProductId,
} from './subscriptionProducts'
import type { SubscriptionChainStatus, SubscriptionEnvironment } from '../../shared/subscriptions/constants'

export type GoogleSubscriptionV2Normalized = {
  source: 'google'
  environment: SubscriptionEnvironment
  storeChainKey: string
  latestTransactionId?: string
  productId: string
  basePlanId?: string
  billingPeriod: 'month' | 'year'
  status: SubscriptionChainStatus
  periodEndsAt?: number
  trialEndsAt?: number
  graceEndsAt?: number
  autoRenew: boolean
  isTrial: boolean
  billingRetry: boolean
  linkedChainKey?: string
  obfuscatedExternalAccountId?: string
}

type Subscriptionsv2Response = {
  lineItems?: Array<{
    productId?: string
    expiryTime?: string
    autoRenewingPlan?: { autoRenewEnabled?: boolean }
    offerDetails?: { basePlanId?: string; offerId?: string }
  }>
  subscriptionState?: string
  linkedPurchaseToken?: string
  testPurchase?: unknown
  acknowledgementState?: string
  startTime?: string
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string
  }
}

function mapGoogleState(
  state: string | undefined,
  now: number,
  expiryMs?: number,
): SubscriptionChainStatus {
  switch (state) {
    case 'SUBSCRIPTION_STATE_PENDING':
      return 'pending'
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return 'grace'
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED':
      return 'suspended'
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return 'expired'
    case 'SUBSCRIPTION_STATE_CANCELED':
      return typeof expiryMs === 'number' && expiryMs > now
        ? 'canceled_active_until'
        : 'expired'
    case 'SUBSCRIPTION_STATE_ACTIVE':
    default:
      return 'active'
  }
}

export function normalizeGoogleSubscriptionsv2(args: {
  purchaseToken: string
  body: Subscriptionsv2Response
  now?: number
  expectedPackageName?: string
}): GoogleSubscriptionV2Normalized {
  const now = args.now ?? Date.now()
  const line = args.body.lineItems?.[0]
  const productId = line?.productId
  if (!productId || !isAllowedGoogleProductId(productId)) {
    throw new Error('GOOGLE_PRODUCT_NOT_ALLOWED')
  }
  const basePlanId = line?.offerDetails?.basePlanId
  const billingPeriod = billingPeriodForGoogle(productId, basePlanId)
  if (!billingPeriod) throw new Error('GOOGLE_PRODUCT_NOT_ALLOWED')

  const expiryMs = line?.expiryTime ? Date.parse(line.expiryTime) : undefined
  const status = mapGoogleState(args.body.subscriptionState, now, expiryMs)
  const isTrial = Boolean(line?.offerDetails?.offerId?.toLowerCase().includes('trial'))
  const environment: SubscriptionEnvironment = args.body.testPurchase
    ? 'sandbox'
    : 'production'

  return {
    source: 'google',
    environment,
    storeChainKey: args.purchaseToken,
    productId,
    basePlanId,
    billingPeriod,
    status: isTrial && status === 'active' ? 'trial' : status,
    periodEndsAt: expiryMs,
    trialEndsAt: isTrial ? expiryMs : undefined,
    graceEndsAt:
      status === 'grace' && typeof expiryMs === 'number' ? expiryMs : undefined,
    autoRenew: Boolean(line?.autoRenewingPlan?.autoRenewEnabled),
    isTrial,
    billingRetry: args.body.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    linkedChainKey: args.body.linkedPurchaseToken,
    obfuscatedExternalAccountId:
      args.body.externalAccountIdentifiers?.obfuscatedExternalAccountId,
  }
}

export async function fetchGoogleSubscriptionsv2(
  purchaseToken: string,
): Promise<Subscriptionsv2Response | null> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME
  const saJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!packageName || !saJson) return null

  // OAuth token acquisition from service account is deferred to configured runtime;
  // without a live token helper we fail closed rather than invent credentials.
  const accessToken = process.env.GOOGLE_PLAY_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('GOOGLE_PLAY_ACCESS_TOKEN_REQUIRED')
  }

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`GOOGLE_SUBSCRIPTIONSV2_HTTP_${res.status}`)
  return (await res.json()) as Subscriptionsv2Response
}

/** Acknowledge initial purchase (≤ 3 jours) — renouvellements non requis. */
export async function acknowledgeGoogleSubscription(args: {
  purchaseToken: string
  subscriptionId: string
}): Promise<boolean> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME
  const accessToken = process.env.GOOGLE_PLAY_ACCESS_TOKEN
  if (!packageName || !accessToken) return false

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptions/` +
    `${encodeURIComponent(args.subscriptionId)}/tokens/${encodeURIComponent(args.purchaseToken)}:acknowledge`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!res.ok && res.status !== 400) {
    // 400 often means already acknowledged
    throw new Error(`GOOGLE_ACKNOWLEDGE_HTTP_${res.status}`)
  }
  return true
}
