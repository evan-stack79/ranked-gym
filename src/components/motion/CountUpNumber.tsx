import { useEffect, useRef, useState } from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/**
 * Metrics allowed to animate from 0 → value.
 * SAFETY (PM / Vérificateur): NEVER add `kcal` or `body_weight` here —
 * those must render instantly via StaticKcalNumber / StaticBodyWeightNumber.
 */
export type CountUpMetricKind = 'water' | 'sessions' | 'successful_sets'

export const COUNT_UP_ALLOWED_KINDS: readonly CountUpMetricKind[] = [
  'water',
  'sessions',
  'successful_sets',
] as const

export interface CountUpNumberProps {
  value: number
  kind: CountUpMetricKind
  /** Locale formatting — default fr-FR. */
  format?: (n: number) => string
  className?: string
  /** Cap duration (ms); default 480, hard max 600. */
  durationMs?: number
  instant?: boolean
  /**
   * When set, remounts reuse the last painted value instead of restarting
   * the count-up from 0 (fixes Accueil tile flashes during drag / edit exit).
   */
  stableId?: string
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function defaultFormat(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

/**
 * Last painted value per stableId — remounts (Accueil edit reorder) must not
 * flash 0 / mid-count when the real value is already known.
 */
const paintedByStableId = new Map<string, number>()

/** Test helper — clear remount cache between cases. */
export function resetCountUpStableCacheForTests(): void {
  paintedByStableId.clear()
}

/**
 * Animated counter for water / sessions / successful sets only.
 * Under prefers-reduced-motion: shows the final value immediately.
 */
export function CountUpNumber({
  value,
  kind,
  format = defaultFormat,
  className = '',
  durationMs = 480,
  instant = false,
  stableId,
}: CountUpNumberProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLSpanElement>({ instant: skip })
  const target = Number.isFinite(value) ? Math.max(0, value) : 0
  const hasPainted =
    stableId != null && paintedByStableId.has(stableId)
  const [display, setDisplay] = useState(() => {
    if (skip) return target
    // Remount after a prior paint: show the current target immediately
    // (never flash 0 or a stale mid-count like 716).
    if (hasPainted) return target
    return 0
  })
  const rafRef = useRef<number | null>(null)
  const playedRef = useRef(hasPainted)

  useEffect(() => {
    if (skip) {
      setDisplay(target)
      if (stableId) paintedByStableId.set(stableId, target)
      return
    }
    if (!inView) return

    // Remount / target sync after the entrance animation already played.
    if (playedRef.current) {
      setDisplay(target)
      if (stableId) paintedByStableId.set(stableId, target)
      return
    }

    const dur = Math.min(600, Math.max(80, durationMs))
    const start = performance.now()
    const from = 0
    playedRef.current = true

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const next = from + (target - from) * easeOutCubic(t)
      setDisplay(next)
      if (stableId) paintedByStableId.set(stableId, next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
        if (stableId) paintedByStableId.set(stableId, target)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [inView, skip, target, durationMs, stableId])

  return (
    <span
      ref={ref}
      className={className}
      data-rg-count={kind}
      data-rg-motion={skip ? 'reduced' : 'on'}
      data-rg-count-stable={stableId ?? undefined}
      aria-label={format(target)}
    >
      {format(display)}
    </span>
  )
}
