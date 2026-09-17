/**
 * Light hardening for deep-link / external navigation.
 * Only https (and localhost http in web dev) may leave the app shell.
 */

const BLOCKED_SCHEMES = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'capacitor:',
  'ionic:',
])

export function isSafeExternalNavigationUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) return false
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol === 'https:') return true
    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Open an external URL in a new tab with noopener/noreferrer when allowed.
 * Returns false if the URL is rejected (no navigation performed).
 */
export function openExternalUrlSafely(raw: string): boolean {
  if (!isSafeExternalNavigationUrl(raw)) return false
  const openFn =
    typeof globalThis.open === 'function'
      ? (globalThis.open as typeof window.open).bind(globalThis)
      : null
  if (!openFn) return false
  const opened = openFn(raw, '_blank', 'noopener,noreferrer')
  if (opened) {
    try {
      opened.opener = null
    } catch {
      // ignore cross-origin assignment failures
    }
  }
  return true
}
