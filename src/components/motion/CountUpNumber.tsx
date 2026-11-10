import { useEffect, useRef, useState } from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/**
 * Metrics allowed to animate on increase.
 * SAFETY (PM / Vérificateur): NEVER add `kcal` or `body_weight` here —
 * those must render instantly via StaticKcalNumber / StaticBodyWeightNumber.
 */
export type CountUpMetricKind = 'water' | 'sessions' | 'successful_sets' | 'ranked_points'

export const COUNT_UP_ALLOWED_KINDS: readonly CountUpMetricKind[] = [
  'water',
  'sessions',
  'successful_sets',
  'ranked_points',
] as const

export interface CountUpNumberProps {
  value: number
  kind: CountUpMetricKind
  /** Locale formatting — default fr-FR. */
  format?: (n: number) => string
  className?: string
  /** Cap duration (ms); default 380, hard max 600. */
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
 * Animated counter for water / sessions / successful sets / Ranked points.
 * Animates only when the value increases (~380 ms ease-out). Decreases jump.
 * Under prefers-reduced-motion: shows the final value immediately.
 */
export function CountUpNumber({
  value,
  kind,
  format = defaultFormat,
  className = '',
  durationMs = 380,
  instant = false,
  stableId,
}: CountUpNumberProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLSpanElement>({ instant: skip })
  const target = Number.isFinite(value) ? Math.max(0, value) : 0
  const hasPainted = stableId != null && paintedByStableId.has(stableId)
  const [display, setDisplay] = useState(() => {
    if (skip) return target
    // Remount after a prior paint: show the current target immediately
    // (never flash 0 or a stale mid-count like 716).
    if (hasPainted) return target
    return 0
  })
  const rafRef = useRef<number | null>(null)
  const playedEntranceRef = useRef(hasPainted)
  const displayRef = useRef(display)
  const targetRef = useRef(target)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    if (skip) {
      setDisplay(target)
      if (stableId) paintedByStableId.set(stableId, target)
      playedEntranceRef.current = true
      return
    }

    const from = displayRef.current

    // Only animate increases. Equal / decreases jump immediately (even off-screen).
    if (playedEntranceRef.current && target <= from) {
      setDisplay(target)
      if (stableId) paintedByStableId.set(stableId, target)
      return
    }

    if (!inView) return

    const dur = Math.min(600, Math.max(80, durationMs))
    const start = performance.now()
    // First entrance still rises from 0; later increases rise from current paint.
    const origin = playedEntranceRef.current ? from : 0
    playedEntranceRef.current = true

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const next = origin + (target - origin) * easeOutCubic(t)
      setDisplay(next)
      if (stableId) paintedByStableId.set(stableId, next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
        if (stableId) paintedByStableId.set(stableId, target)
        rafRef.current = null
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
