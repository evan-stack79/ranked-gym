import { useEffect, useState } from 'react'
import {
  PREFERS_REDUCED_MOTION_QUERY,
  readPrefersReducedMotion,
} from '../utils/prefersReducedMotion'

export { readPrefersReducedMotion } from '../utils/prefersReducedMotion'

/** Live `prefers-reduced-motion: reduce` — animations must show content immediately when true. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPrefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PREFERS_REDUCED_MOTION_QUERY)
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return reduced
}
