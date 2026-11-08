/**
 * Vérification App Store Server JWS (ARCHI §5.1).
 * Décoder Base64 n’est PAS vérifier — signature + claims obligatoires.
 *
 * En prod : `jose` + chaîne x5c ancrée sur racines Apple (certificats fournis via env /
 * bundle de confiance). Sans secrets/config, la vérif échoue (fail-closed).
 */
import { compactVerify, importX509, type CompactVerifyResult } from 'jose'
import {
  PRO_FAMILY_SHARING_ENABLED,
  type SubscriptionChainStatus,
  type SubscriptionEnvironment,
} from '../../shared/subscriptions/constants'
import { readSubscriptionEnv } from './subscriptionEnv'
import { billingPeriodForAppleProduct, isAllowedAppleProductId } from './subscriptionProducts'

export type AppleTransactionClaims = {
  transactionId?: string
  originalTransactionId?: string
  bundleId?: string
  productId?: string
  type?: string
  environment?: string
  expiresDate?: number
  purchaseDate?: number
  originalPurchaseDate?: number
  revocationDate?: number
  offerDiscountType?: string
  offerType?: number
  appAccountToken?: string
  inAppOwnershipType?: string
  transactionReason?: string
}

export type AppleRenewalClaims = {
  autoRenewStatus?: number
  autoRenewProductId?: string
  expirationIntent?: number
  gracePeriodExpiresDate?: number
  isInBillingRetryPeriod?: boolean
  offerType?: number
}

function b64urlToUtf8(part: string): string {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4))
  const b64 = (part + pad).replace(/-/g, '+').replace(/_/g, '/')
  // Prefer atob (Convex isolate / browser); avoid Node Buffer for convex typecheck.
  const binary =
    typeof atob === 'function'
      ? atob(b64)
      : (() => {
          throw new Error('B64_DECODE_UNAVAILABLE')
        })()
  return decodeURIComponent(
    Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  )
}

export function decodeJwsPayloadUnsafe(jws: string): Record<string, unknown> {
  const parts = jws.split('.')
  if (parts.length !== 3) throw new Error('JWS_MALFORMED')
  return JSON.parse(b64urlToUtf8(parts[1]!)) as Record<string, unknown>
}

export function decodeJwsHeaderUnsafe(jws: string): { alg?: string; x5c?: string[] } {
  const parts = jws.split('.')
  if (parts.length !== 3) throw new Error('JWS_MALFORMED')
  return JSON.parse(b64urlToUtf8(parts[0]!)) as { alg?: string; x5c?: string[] }
}

/**
 * Vérifie la signature JWS avec le premier certificat x5c (leaf).
 * Ancrage racine Apple : si `APPLE_ROOT_CA_PEMS` (PEMs concaténés, séparateur `-----END CERTIFICATE-----`)
 * est défini, on exige que le dernier x5c matche une racine listée (comparaison PEM normalisée).
 * Sans ancrage configuré en production → refus.
 */
export async function verifyAppleJwsSignature(jws: string): Promise<{
  payload: Record<string, unknown>
  protectedHeader: CompactVerifyResult['protectedHeader']
}> {
  const header = decodeJwsHeaderUnsafe(jws)
  if (header.alg !== 'ES256') throw new Error('JWS_ALG_UNSUPPORTED')
  const x5c = header.x5c
  if (!x5c || x5c.length === 0) throw new Error('JWS_MISSING_X5C')

  const leafPem = derToPem(x5c[0]!)
  const key = await importX509(leafPem, 'ES256')

  const deployEnv = (readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production').toLowerCase()
  const roots = (readSubscriptionEnv('APPLE_ROOT_CA_PEMS') ?? '').trim()
  if (deployEnv === 'production' && !roots) {
    throw new Error('APPLE_ROOT_CA_NOT_CONFIGURED')
  }
  if (roots) {
    const chainRoot = derToPem(x5c[x5c.length - 1]!)
    const normalizedRoots = roots
      .split(/(?=-----BEGIN CERTIFICATE-----)/g)
      .map((p) => p.trim())
      .filter(Boolean)
      .map(normalizePem)
    if (!normalizedRoots.includes(normalizePem(chainRoot))) {
      throw new Error('APPLE_ROOT_ANCHOR_MISMATCH')
    }
  }

  const { payload, protectedHeader } = await compactVerify(jws, key)
  const text = new TextDecoder().decode(payload)
  return { payload: JSON.parse(text) as Record<string, unknown>, protectedHeader }
}

function derToPem(derB64: string): string {
  const lines = derB64.match(/.{1,64}/g) ?? [derB64]
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`
}

function normalizePem(pem: string): string {
  return pem.replace(/\s+/g, '')
}

export function mapAppleEnvironment(env?: string): SubscriptionEnvironment {
  const e = (env ?? '').toLowerCase()
  if (e === 'sandbox' || e === 'xcode') return 'sandbox'
  return 'production'
}

export function mapAppleStatus(args: {
  claims: AppleTransactionClaims
  renewal?: AppleRenewalClaims | null
  now: number
}): SubscriptionChainStatus {
  const { claims, renewal, now } = args
  if (claims.revocationDate) return 'revoked'
  const expires = claims.expiresDate
  const grace = renewal?.gracePeriodExpiresDate
  if (grace && grace > now && renewal?.isInBillingRetryPeriod) return 'grace'
  if (typeof expires === 'number' && expires <= now) {
    if (renewal?.isInBillingRetryPeriod) return 'suspended'
    return 'expired'
  }
  const isTrial =
    claims.offerType === 1 ||
    claims.offerDiscountType === 'FREE_TRIAL' ||
    claims.offerDiscountType === 'free_trial'
  const autoRenewOff = renewal?.autoRenewStatus === 0
  if (autoRenewOff) return 'canceled_active_until'
  if (isTrial) return 'trial'
  return 'active'
}

export type NormalizedApplePurchase = {
  source: 'apple'
  environment: SubscriptionEnvironment
  storeChainKey: string
  latestTransactionId: string
  productId: string
  billingPeriod: 'month' | 'year'
  status: SubscriptionChainStatus
  periodEndsAt?: number
  trialEndsAt?: number
  graceEndsAt?: number
  autoRenew: boolean
  isTrial: boolean
  billingRetry: boolean
  familyShared: boolean
  revokedAt?: number
  refundedAt?: number
  appAccountToken?: string
  bundleId?: string
}

export function normalizeAppleTransaction(args: {
  claims: AppleTransactionClaims
  renewal?: AppleRenewalClaims | null
  now?: number
  expectedBundleId?: string
}): NormalizedApplePurchase {
  const now = args.now ?? Date.now()
  const claims = args.claims
  if (!claims.originalTransactionId) throw new Error('APPLE_MISSING_ORIGINAL_TX')
  if (!claims.transactionId) throw new Error('APPLE_MISSING_TX')
  if (!claims.productId) throw new Error('APPLE_MISSING_PRODUCT')
  if (!isAllowedAppleProductId(claims.productId)) {
    throw new Error('APPLE_PRODUCT_NOT_ALLOWED')
  }
  const billingPeriod = billingPeriodForAppleProduct(claims.productId)
  if (!billingPeriod) throw new Error('APPLE_PRODUCT_NOT_ALLOWED')

  const expectedBundle = args.expectedBundleId ?? readSubscriptionEnv('APPLE_BUNDLE_ID')
  if (expectedBundle && claims.bundleId && claims.bundleId !== expectedBundle) {
    throw new Error('APPLE_BUNDLE_MISMATCH')
  }

  const familyShared = claims.inAppOwnershipType === 'FAMILY_SHARED'
  if (!PRO_FAMILY_SHARING_ENABLED && familyShared) {
    throw new Error('FAMILY_SHARING_DISABLED')
  }

  const status = mapAppleStatus({ claims, renewal: args.renewal, now })
  const isTrial =
    claims.offerType === 1 ||
    claims.offerDiscountType === 'FREE_TRIAL' ||
    claims.offerDiscountType === 'free_trial'
  const autoRenew = args.renewal?.autoRenewStatus !== 0

  return {
    source: 'apple',
    environment: mapAppleEnvironment(claims.environment),
    storeChainKey: claims.originalTransactionId,
    latestTransactionId: claims.transactionId,
    productId: claims.productId,
    billingPeriod,
    status,
    periodEndsAt: claims.expiresDate,
    trialEndsAt: isTrial ? claims.expiresDate : undefined,
    graceEndsAt: args.renewal?.gracePeriodExpiresDate,
    autoRenew,
    isTrial,
    billingRetry: Boolean(args.renewal?.isInBillingRetryPeriod),
    familyShared,
    revokedAt: claims.revocationDate,
    refundedAt: claims.revocationDate,
    appAccountToken: claims.appAccountToken,
    bundleId: claims.bundleId,
  }
}

/**
 * Mode test local uniquement : accepte un payload JSON non signé quand
 * SUBSCRIPTION_DEPLOY_ENV=test|local et le corps commence par `localtest.`.
 * Jamais en production.
 */
export function parseLocalTestApplePayload(signedTransaction: string): AppleTransactionClaims | null {
  const deployEnv = (readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production').toLowerCase()
  if (deployEnv === 'production') return null
  if (!signedTransaction.startsWith('localtest.')) return null
  const json = signedTransaction.slice('localtest.'.length)
  return JSON.parse(json) as AppleTransactionClaims
}
