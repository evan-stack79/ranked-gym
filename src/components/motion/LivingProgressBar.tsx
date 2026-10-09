import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { PROGRESS_FILL_MS } from './sessionActionGuards'

export type LivingProgressBarProps = {
  /** 0–1 */
  value: number
  className?: string
  trackClassName?: string
  fillClassName?: string
  /** Sparks once when the bar first reaches 100%. Never again if exceeded. */
  sparksAtFull?: boolean
  /** Skip fill animation (tests / reduced path). */
  instant?: boolean
  'aria-label'?: string
}

/**
 * Reusable progress fill — transform scaleX, ≤400 ms.
 * Never use for kcal / body-weight / load displays.
 * At 100%: optional sparks once, then quiet.
 */
export function LivingProgressBar({
  value,
  className = '',
  trackClassName = '',
  fillClassName = '',
  sparksAtFull = true,
  instant = false,
  'aria-label': ariaLabel,
}: LivingProgressBarProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const [shown, setShown] = useState(skip ? clamped : 0)
  const sparkedRef = useRef(false)
  const [sparked, setSparked] = useState(false)
  const [sparking, setSparking] = useState(false)

  useEffect(() => {
    if (skip) {
      setShown(clamped)
      return
    }
    const id = window.requestAnimationFrame(() => setShown(clamped))
    return () => window.cancelAnimationFrame(id)
  }, [clamped, skip])

  useEffect(() => {
    if (!sparksAtFull || skip || sparkedRef.current) return
    if (clamped < 1) return
    sparkedRef.current = true
    setSparked(true)
    setSparking(true)
    const id = window.setTimeout(() => setSparking(false), 420)
    return () => window.clearTimeout(id)
  }, [clamped, sparksAtFull, skip])

  return (
    <div
      className={`rg-living-progress ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={ariaLabel}
      data-rg-anim="living-progress"
      data-rg-progress={String(Math.round(clamped * 100))}
      data-rg-sparked={sparked ? '1' : '0'}
    >
      <div className={`rg-living-progress__track ${trackClassName}`}>
        <div
          className={`rg-living-progress__fill motion-progress-fill ${fillClassName}`}
          style={{
            transform: `scaleX(${shown})`,
            transition: skip
              ? undefined
              : `transform ${PROGRESS_FILL_MS}ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))`,
          }}
        />
        {sparking ? (
          <span className="rg-living-progress__sparks" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={`rg-living-progress__spark rg-living-progress__spark--${i}`} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}
