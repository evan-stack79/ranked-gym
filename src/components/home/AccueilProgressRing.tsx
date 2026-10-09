import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface AccueilProgressRingProps {
  /** 0–1 */
  progress: number
  accent: string
  /** Soft glow / track colour */
  track?: string
  size?: number
  strokeWidth?: number
  className?: string
  /** Skip sweep animation (cold enter / tests). */
  instant?: boolean
}

/**
 * Simple SVG progress ring for Accueil metric tiles.
 * Under prefers-reduced-motion: no sweep — final progress immediately.
 */
export function AccueilProgressRing({
  progress,
  accent,
  track = 'rgba(255,255,255,0.08)',
  size = 72,
  strokeWidth = 7,
  className = '',
  instant = false,
}: AccueilProgressRingProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  const [shown, setShown] = useState(skip ? clamped : 0)

  useEffect(() => {
    if (skip) {
      setShown(clamped)
      return
    }
    setShown(0)
    const id = window.requestAnimationFrame(() => setShown(clamped))
    return () => window.cancelAnimationFrame(id)
  }, [clamped, skip])

  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - shown)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
      data-accueil-ring
      data-accueil-ring-progress={String(Math.round(clamped * 100))}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: skip
            ? undefined
            : 'stroke-dashoffset 360ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
          filter: `drop-shadow(0 0 6px ${accent}88)`,
        }}
      />
    </svg>
  )
}
