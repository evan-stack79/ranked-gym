/**
 * Partner caisse code / reason sanitization (QA M1 — no raw HTML in logs).
 * Generated codes look like `RG-` + opaque base64url slice (see redeemItemCore).
 */

export const PARTNER_CODE_MAX_LEN = 64
export const PARTNER_CODE_MIN_LEN = 4
/**
 * Alphanumeric + safe separators only — rejects `<`, quotes, spaces, etc.
 * Must allow trailing `-`/`_` (opaque base64url slices from redeemItemCore).
 */
export const PARTNER_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/

export const PARTNER_REASON_MAX_LEN = 200

export type SanitizeCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: 'REWARDS_CODE_INVALID_FORMAT' }

/**
 * Normalize + validate redemption code before lookup/consume/refuse/log.
 * Never pass through raw HTML / script payloads into action logs.
 */
export function sanitizePartnerCode(raw: string): SanitizeCodeResult {
  const code = raw.trim()
  if (code.length < PARTNER_CODE_MIN_LEN || code.length > PARTNER_CODE_MAX_LEN) {
    return { ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' }
  }
  if (!PARTNER_CODE_PATTERN.test(code)) {
    return { ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' }
  }
  return { ok: true, code }
}

/** Safe placeholder stored when a malformed code attempt is denied (never the raw input). */
export const PARTNER_CODE_LOG_REJECTED = '[invalid_format]'

export function sanitizePartnerReason(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, PARTNER_REASON_MAX_LEN)
  return cleaned.length > 0 ? cleaned : undefined
}
