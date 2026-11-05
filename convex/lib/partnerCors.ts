/**
 * OP-d prep — partner-tool origin whitelist (ARCHI_OUTIL_PARTENAIRE §2).
 * Marketing site origin must NOT be listed; mutations stay partner-session gated.
 *
 * Env (Convex dashboard / VPS secrets — never in public partner-tool bundle):
 *   PARTNER_TOOL_ORIGIN=https://partners.example.com
 *   (comma-separated for staging + prod)
 */

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

/** Placeholder default — replace with real partners.* subdomain after Evan confirms. */
export const PARTNER_TOOL_ORIGIN_PLACEHOLDER = 'https://partners.example.com'

export function getPartnerToolAllowedOrigins(): string[] {
  const raw = readEnv('PARTNER_TOOL_ORIGIN')?.trim()
  if (!raw) return [PARTNER_TOOL_ORIGIN_PLACEHOLDER]
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isPartnerToolOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false
  const normalized = origin.trim().replace(/\/$/, '')
  return getPartnerToolAllowedOrigins().some(
    (allowed) => allowed.replace(/\/$/, '') === normalized,
  )
}

/**
 * CORS headers for partner-tool HTTP routes (http.ts).
 * Reflects only whitelisted origins — marketing origin gets no ACAO.
 */
export function partnerToolCorsHeaders(
  requestOrigin: string | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Partner-Session',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (isPartnerToolOriginAllowed(requestOrigin) && requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin.replace(/\/$/, '')
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}
