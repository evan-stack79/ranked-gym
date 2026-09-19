import { isConvexConfigured } from '../lib/convex'
import { parseBooleanFlag } from './featureFlag'

export type AuthBackendKind = 'supabase' | 'convex'

/**
 * Dedicated auth migration flag.
 * Supabase remains active unless this flag is true and Convex is configured.
 */
export function isConvexAuthEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_CONVEX_AUTH,
): boolean {
  return parseBooleanFlag(raw)
}

export function getRequestedAuthBackend(): AuthBackendKind {
  if (isConvexAuthEnabled() && isConvexConfigured()) return 'convex'
  return 'supabase'
}

export function getActiveAuthBackend(): AuthBackendKind {
  return getRequestedAuthBackend()
}
