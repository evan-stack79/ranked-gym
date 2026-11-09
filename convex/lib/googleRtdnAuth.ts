/**
 * Vérifie le JWT OIDC Pub/Sub push Google (QA m1).
 * Audience + issuer Google + email service account attendu.
 */
'use node'

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { readSubscriptionEnv } from './subscriptionEnv'

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)

export async function verifyGoogleRtdnOidc(args: {
  bearerToken: string
  audience: string
  expectedEmail: string
}): Promise<{ email: string; sub: string }> {
  const { payload } = await jwtVerify(args.bearerToken, GOOGLE_JWKS, {
    audience: args.audience,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  })
  const email = typeof payload.email === 'string' ? payload.email : ''
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  if (!email || !emailVerified) throw new Error('GOOGLE_RTDN_EMAIL_UNVERIFIED')
  if (email.toLowerCase() !== args.expectedEmail.toLowerCase()) {
    throw new Error('GOOGLE_RTDN_EMAIL_MISMATCH')
  }
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  if (!sub) throw new Error('GOOGLE_RTDN_SUB_MISSING')
  return { email, sub }
}

export function readGoogleRtdnAuthConfig(): {
  audience: string
  expectedEmail: string
} | null {
  const audience = readSubscriptionEnv('GOOGLE_RTDN_AUDIENCE')?.trim()
  const expectedEmail = readSubscriptionEnv('GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL')?.trim()
  if (!audience || !expectedEmail) return null
  return { audience, expectedEmail }
}
