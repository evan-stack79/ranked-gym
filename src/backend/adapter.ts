import { isSupabaseConfigured } from '../lib/supabase'
import { isConvexConfigured } from '../lib/convex'
import { isConvexPrimaryEnabled } from './featureFlag'

export type CloudBackendKind = 'supabase' | 'convex'

export type CloudBackendAdapter = {
  /** What the build flag asks for, if Convex is configured. */
  requested: CloudBackendKind
  /**
   * Domain I/O backend. Supabase remains default until
   * `VITE_ENABLE_CONVEX_PRIMARY=true` and `VITE_CONVEX_URL` is configured.
   */
  active: CloudBackendKind
  convexConfigured: boolean
  supabaseConfigured: boolean
}

/**
 * Requested cloud backend after `VITE_ENABLE_CONVEX_PRIMARY`.
 */
export function getRequestedCloudBackend(): CloudBackendKind {
  if (isConvexPrimaryEnabled() && isConvexConfigured()) return 'convex'
  return 'supabase'
}

/** Actual domain I/O backend for profile/train/nutrition/sleep/streak/backup. */
export function getActiveCloudBackend(): CloudBackendKind {
  return getRequestedCloudBackend()
}

export function isConvexDomainActive(): boolean {
  return getActiveCloudBackend() === 'convex'
}

export function isActiveCloudBackendConfigured(): boolean {
  if (isConvexDomainActive()) return isConvexConfigured()
  return isSupabaseConfigured()
}

export function getCloudBackendAdapter(): CloudBackendAdapter {
  return {
    requested: getRequestedCloudBackend(),
    active: getActiveCloudBackend(),
    convexConfigured: isConvexConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
  }
}
