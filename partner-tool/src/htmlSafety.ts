/**
 * HTML escaping for partner-tool innerHTML renders (QA M1 stored XSS).
 * Code format mirrors convex/lib/partnerCode.ts (keep in sync).
 */

const PARTNER_CODE_MAX_LEN = 64
const PARTNER_CODE_MIN_LEN = 4
const PARTNER_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Attribute-safe (value="…"). */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

export function sanitizePartnerCode(
  raw: string,
): { ok: true; code: string } | { ok: false; error: 'REWARDS_CODE_INVALID_FORMAT' } {
  const code = raw.trim()
  if (code.length < PARTNER_CODE_MIN_LEN || code.length > PARTNER_CODE_MAX_LEN) {
    return { ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' }
  }
  if (!PARTNER_CODE_PATTERN.test(code)) {
    return { ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' }
  }
  return { ok: true, code }
}

export type HistoryRow = {
  code: string
  action: string
  result: string
  errorCode: string | null
  reason: string | null
  createdAt: number
}

/** Pure HTML for history list — all dynamic fields escaped (XSS regression target). */
export function renderHistoryItemsHtml(
  history: HistoryRow[],
  locale = 'fr-FR',
): string {
  if (history.length === 0) {
    return '<li class="meta">Aucune action récente.</li>'
  }
  return history
    .map((h) => {
      const err = h.errorCode ? ` (${escapeHtml(h.errorCode)})` : ''
      const reason = h.reason ? ` · ${escapeHtml(h.reason)}` : ''
      const when = escapeHtml(new Date(h.createdAt).toLocaleString(locale))
      return `<li>
        <div><strong>${escapeHtml(h.action)}</strong> · ${escapeHtml(h.result)}${err}</div>
        <div class="meta"><span class="code-input" style="font-size:0.8rem">${escapeHtml(h.code)}</span> · ${when}${reason}</div>
      </li>`
    })
    .join('')
}
