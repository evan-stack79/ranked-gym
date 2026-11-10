const QUERY = '(prefers-reduced-motion: reduce)'

/** Sync read of `prefers-reduced-motion: reduce` (SSR-safe). */
export function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(QUERY).matches
}

export const PREFERS_REDUCED_MOTION_QUERY = QUERY
