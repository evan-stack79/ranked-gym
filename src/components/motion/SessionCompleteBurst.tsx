import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { animMs } from './animTiming'
import {
  SESSION_COMPLETE_BURST_MS,
  SESSION_COMPLETE_REDUCED_MS,
} from './sessionActionGuards'

export type SessionCompleteBurstProps = {
  open: boolean
  onComplete: () => void
  /** Test override — force reduced-motion path. */
  forceReducedMotion?: boolean
}

/**
 * Fin de séance — adapted from CodePen haniotis/KwvYLO (circle + check)
 * plus 12 sparks. Always identical, ≤580ms, skippable immediately.
 */
export function SessionCompleteBurst({
  open,
  onComplete,
  forceReducedMotion,
}: SessionCompleteBurstProps) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = forceReducedMotion ?? prefersReduced
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!open) {
      completedRef.current = false
      return
    }
    completedRef.current = false
    if (reduced) {
      completedRef.current = true
      onCompleteRef.current()
      return
    }
    const id = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onCompleteRef.current()
    }, animMs(SESSION_COMPLETE_BURST_MS))
    return () => window.clearTimeout(id)
  }, [open, reduced])

  if (!open || reduced) return null

  const skip = () => {
    if (completedRef.current) return
    completedRef.current = true
    onCompleteRef.current()
  }

  return (
    <div
      className="rg-session-burst"
      role="status"
      aria-live="polite"
      aria-label="Séance terminée"
      data-rg-anim="session-complete"
      data-rg-session-burst="1"
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          skip()
        }
      }}
      tabIndex={0}
    >
      <div className="rg-session-burst__stage" aria-hidden="true">
        <svg
          className="rg-session-burst__mark"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52"
        >
          <circle className="rg-session-burst__circle" cx="26" cy="26" r="25" fill="none" />
          <path
            className="rg-session-burst__check"
            fill="none"
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
          />
        </svg>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`rg-session-burst__spark rg-session-burst__spark--${i}`} />
        ))}
      </div>
      <p className="rg-session-burst__label">Séance terminée</p>
      <button
        type="button"
        className="rg-session-burst__skip ios-press"
        data-rg-session-burst-skip="1"
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
      >
        Continuer
      </button>
    </div>
  )
}

export { SESSION_COMPLETE_BURST_MS, SESSION_COMPLETE_REDUCED_MS }
