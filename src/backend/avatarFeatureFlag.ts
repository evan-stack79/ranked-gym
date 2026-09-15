import { isConvexDomainActive } from './adapter'
import { getActiveAuthBackend } from './authFeatureFlag'

/**
 * Avatar storage switches to Convex only when:
 * 1) Convex is the active domain backend, and
 * 2) Convex auth/session is active (private files require Convex session token).
 */
export function isConvexAvatarStorageActive(): boolean {
  return isConvexDomainActive() && getActiveAuthBackend() === 'convex'
}
