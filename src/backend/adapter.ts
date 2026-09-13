import { isSupabaseConfigured } from '../lib/supabase'
import { isConvexConfigured } from '../lib/convex'
import { isConvexPrimaryEnabled } from './featureFlag'

export type CloudBackendKind = 'supabase' | 'convex'

export type CloudBackendAdapter = {
  /** What the build flag asks for, if Convex is configured. */
  requested: CloudBackendKind
  /**
   * Phase A lock: domain services still read/write Supabase + local storage.
   * Later phases may return `convex` once those services are migrated.
   */
  active: 'supabase'
  convexConfigured: boolean
  supabaseConfigured: boolean
}

/**
 * Requested cloud backend after `VITE_ENABLE_CONVEX_PRIMARY`.
 * Does not change runtime I/O in Phase A.
 */
export function getRequestedCloudBackend(): CloudBackendKind {
  if (isConvexPrimaryEnabled() && isConvexConfigured()) return 'convex'
  return 'supabase'
}

/** Actual domain I/O backend. Always Supabase until a later migration PR. */
export function getActiveCloudBackend(): 'supabase' {
  return 'supabase'
}

export function getCloudBackendAdapter(): CloudBackendAdapter {
  return {
    requested: getRequestedCloudBackend(),
    active: getActiveCloudBackend(),
    convexConfigured: isConvexConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
  }
}
