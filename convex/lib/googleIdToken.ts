/**
 * Google ID token verification (B11-01).
 * Phone sends only the ID token; email/sub are read from verified claims.
 * Fail-closed when client id is unset; kill-switch via CONVEX_GOOGLE_SIGNIN_ENABLED.
 */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ALLOWED_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
/** Cache Google JWKS for 1h (refresh on miss / expiry). */
export const GOOGLE_JWKS_CACHE_TTL_MS = 60 * 60 * 1000
/** Allow small clock skew for iat in the future. */
const IAT_FUTURE_SKEW_SEC = 5 * 60
/** Reject tokens whose iat is older than 24h (sane bound). */
const IAT_MAX_AGE_SEC = 24 * 60 * 60

export const AUTH_GOOGLE_DISABLED = 'AUTH_GOOGLE_DISABLED'
export const AUTH_GOOGLE_TOKEN_INVALID = 'AUTH_GOOGLE_TOKEN_INVALID'

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

/** Kill switch from 6a32d91 — off unless explicitly enabled. */
export function isGoogleSignInEnabled(): boolean {
  return parseBooleanFlag(readEnv('CONVEX_GOOGLE_SIGNIN_ENABLED'))
}

/** Server Google OAuth client id — required for Google sign-in. */
export function getGoogleClientId(): string {
  return (
    readEnv('GOOGLE_CLIENT_ID')?.trim() ||
    readEnv('CONVEX_GOOGLE_CLIENT_ID')?.trim() ||
    ''
  )
}

/**
 * Ready to verify: kill switch ON and client id configured.
 * Fail-closed by default (enabled flag false OR missing client id).
 */
export function isGoogleSignInConfigured(): boolean {
  return isGoogleSignInEnabled() && getGoogleClientId().length > 0
}

/**
 * Throws AUTH_GOOGLE_DISABLED when kill switch is off or client id missing.
 */
export function requireGoogleSignInReady(): string {
  if (!isGoogleSignInEnabled()) throw new Error(AUTH_GOOGLE_DISABLED)
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error(AUTH_GOOGLE_DISABLED)
  return clientId
}

export type GoogleJwks = {
  keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>
}

export type VerifiedGoogleIdToken = {
  email: string
  sub: string
  emailVerified: true
  name?: string
}

type JwksCacheEntry = { fetchedAtMs: number; jwks: GoogleJwks }

let jwksCache: JwksCacheEntry | null = null

/** Test / admin helper — clear in-memory JWKS cache. */
export function clearGoogleJwksCache(): void {
  jwksCache = null
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeJsonPart(part: string): Record<string, unknown> {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(part))
    const value = JSON.parse(json) as unknown
    if (!value || typeof value !== 'object') throw new Error('bad')
    return value as Record<string, unknown>
  } catch {
    throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  }
}

export type GoogleIdTokenVerifyDeps = {
  clientId: string
  nowMs?: number
  fetchJwks?: () => Promise<GoogleJwks>
  /** Skip cache when injecting test JWKS. */
  bypassJwksCache?: boolean
}

async function defaultFetchGoogleJwks(): Promise<GoogleJwks> {
  const response = await fetch(GOOGLE_JWKS_URL)
  if (!response.ok) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  const body = (await response.json()) as GoogleJwks
  if (!body?.keys || !Array.isArray(body.keys)) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  return body
}

/** Cached JWKS fetch — production default. */
export async function fetchGoogleJwksCached(
  nowMs = Date.now(),
  fetchJwks: () => Promise<GoogleJwks> = defaultFetchGoogleJwks,
): Promise<GoogleJwks> {
  if (jwksCache && nowMs - jwksCache.fetchedAtMs < GOOGLE_JWKS_CACHE_TTL_MS) {
    return jwksCache.jwks
  }
  const jwks = await fetchJwks()
  jwksCache = { fetchedAtMs: nowMs, jwks }
  return jwks
}

async function verifyRs256Signature(
  signingInput: string,
  signature: Uint8Array,
  jwk: JsonWebKey,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature as BufferSource,
    new TextEncoder().encode(signingInput),
  )
}

/**
 * Validate Google ID token claims after signature verification.
 */
export function assertGoogleIdTokenClaims(
  payload: Record<string, unknown>,
  args: { clientId: string; nowMs?: number },
): VerifiedGoogleIdToken {
  const nowMs = args.nowMs ?? Date.now()
  const nowSec = Math.floor(nowMs / 1000)

  const iss = typeof payload.iss === 'string' ? payload.iss : ''
  if (!ALLOWED_ISSUERS.has(iss)) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const aud = payload.aud
  const audOk =
    (typeof aud === 'string' && aud === args.clientId) ||
    (Array.isArray(aud) && aud.some((entry) => entry === args.clientId))
  if (!audOk) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const exp = typeof payload.exp === 'number' ? payload.exp : NaN
  if (!Number.isFinite(exp) || exp <= nowSec) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const iat = typeof payload.iat === 'number' ? payload.iat : NaN
  if (!Number.isFinite(iat)) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  if (iat > nowSec + IAT_FUTURE_SKEW_SEC) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  if (iat < nowSec - IAT_MAX_AGE_SEC) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  if (!emailVerified) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  if (!email || !sub) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const name = typeof payload.name === 'string' ? payload.name.trim() : undefined
  return {
    email,
    sub,
    emailVerified: true as const,
    name: name || undefined,
  }
}

/** Full verify: JWKS signature (cached) + Google claim rules. */
export async function verifyGoogleIdToken(
  idToken: string,
  deps: GoogleIdTokenVerifyDeps,
): Promise<VerifiedGoogleIdToken> {
  const token = idToken.trim()
  if (!token || token.split('.').length !== 3) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)
  if (!deps.clientId.trim()) throw new Error(AUTH_GOOGLE_DISABLED)

  const [headerB64, payloadB64, sigB64] = token.split('.') as [string, string, string]
  const header = decodeJsonPart(headerB64)
  const payload = decodeJsonPart(payloadB64)
  if (header.alg !== 'RS256') throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const nowMs = deps.nowMs ?? Date.now()
  const fetchFn = deps.fetchJwks ?? defaultFetchGoogleJwks
  const jwks = deps.bypassJwksCache
    ? await fetchFn()
    : await fetchGoogleJwksCached(nowMs, fetchFn)

  const kid = typeof header.kid === 'string' ? header.kid : undefined
  const candidates = jwks.keys.filter((key) => {
    if (key.kty !== 'RSA') return false
    if (kid && key.kid && key.kid !== kid) return false
    return true
  })
  if (candidates.length === 0) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  const signingInput = `${headerB64}.${payloadB64}`
  const signature = base64UrlToBytes(sigB64)
  let ok = false
  for (const jwk of candidates) {
    try {
      if (await verifyRs256Signature(signingInput, signature, jwk)) {
        ok = true
        break
      }
    } catch {
      // try next key
    }
  }
  if (!ok) throw new Error(AUTH_GOOGLE_TOKEN_INVALID)

  return assertGoogleIdTokenClaims(payload, {
    clientId: deps.clientId,
    nowMs,
  })
}

/** Test helper — mint RS256 JWT with a local keypair (never used in production path). */
export async function mintTestGoogleIdToken(args: {
  privateKey: CryptoKey
  publicJwk: JsonWebKey & { kid?: string }
  claims: Record<string, unknown>
}): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: args.publicJwk.kid ?? 'test-kid',
  }
  const headerB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(args.claims)))
  const signingInput = `${headerB64}.${payloadB64}`
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    args.privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(sig))}`
}

export async function generateTestGoogleKeyPair(): Promise<{
  privateKey: CryptoKey
  publicJwk: JsonWebKey & { kid: string }
}> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey & {
    kid: string
  }
  publicJwk.kid = 'test-kid'
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  return { privateKey: pair.privateKey, publicJwk }
}
