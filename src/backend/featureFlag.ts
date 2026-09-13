/**
 * Convex feature flag. Off by default — Supabase remains the runtime backend.
 * Enable only with VITE_ENABLE_CONVEX_PRIMARY=true at build time.
 *
 * Phase A: this flag does not switch domain I/O. See `getActiveCloudBackend`.
 */
export function parseBooleanFlag(raw: string | undefined): boolean {
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function isConvexPrimaryEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_CONVEX_PRIMARY,
): boolean {
  return parseBooleanFlag(raw)
}
