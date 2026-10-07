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
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function defaultFormat(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
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
}: CountUpNumberProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLSpanElement>({ instant: skip })
  const target = Number.isFinite(value) ? Math.max(0, value) : 0
  const [display, setDisplay] = useState(skip ? target : 0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (skip) {
      setDisplay(target)
      return
    }
    if (!inView) return

    const dur = Math.min(600, Math.max(80, durationMs))
    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const next = from + (target - from) * easeOutCubic(t)
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [inView, skip, target, durationMs])

  return (
    <span
      ref={ref}
      className={className}
      data-rg-count={kind}
      data-rg-motion={skip ? 'reduced' : 'on'}
      aria-label={format(target)}
    >
      {format(display)}
    </span>
  )
}
