/**
 * App Store Server API — relecture d’état après JWS (ARCHI §5.1 point 5).
 * JWT ES256 signé avec APPLE_IAP_PRIVATE_KEY / KEY_ID / ISSUER_ID.
 * Sans credentials : retourne null (la vérif JWS locale reste obligatoire en amont).
 */
import { SignJWT, importPKCS8 } from 'jose'

export type AppleSubscriptionApiSnapshot = {
  originalTransactionId: string
  status?: number
  signedTransactionInfo?: string
  signedRenewalInfo?: string
}

function appleApiBase(environment: 'production' | 'sandbox'): string {
  return environment === 'sandbox'
    ? 'https://api.storekit-sandbox.itunes.apple.com'
    : 'https://api.storekit.itunes.apple.com'
}

export async function createAppleServerApiToken(): Promise<string | null> {
  const keyId = process.env.APPLE_IAP_KEY_ID
  const issuerId = process.env.APPLE_IAP_ISSUER_ID
  const privateKeyPem = process.env.APPLE_IAP_PRIVATE_KEY
  const bundleId = process.env.APPLE_BUNDLE_ID
  if (!keyId || !issuerId || !privateKeyPem || !bundleId) return null

  const key = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'ES256')
  return await new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime('20m')
    .setAudience('appstoreconnect-v1')
    .sign(key)
}

/**
 * GET /inApps/v1/subscriptions/{originalTransactionId}
 * Retourne null si non configuré ; throw si HTTP non-2xx après config.
 */
export async function fetchAppleSubscriptionStatus(
  originalTransactionId: string,
  environment: 'production' | 'sandbox',
): Promise<AppleSubscriptionApiSnapshot | null> {
  const token = await createAppleServerApiToken()
  if (!token) return null

  const url = `${appleApiBase(environment)}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`APPLE_SERVER_API_HTTP_${res.status}`)
  }
  const body = (await res.json()) as {
    data?: Array<{
      lastTransactions?: Array<{
        originalTransactionId?: string
        status?: number
        signedTransactionInfo?: string
        signedRenewalInfo?: string
      }>
    }>
  }
  const last = body.data?.[0]?.lastTransactions?.[0]
  if (!last?.originalTransactionId) {
    return { originalTransactionId }
  }
  return {
    originalTransactionId: last.originalTransactionId,
    status: last.status,
    signedTransactionInfo: last.signedTransactionInfo,
    signedRenewalInfo: last.signedRenewalInfo,
  }
}
