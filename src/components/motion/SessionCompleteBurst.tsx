import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
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
 * Fin de séance — always identical (~1 s):
 * red circle grows → check draws → sparks fly out.
 * No count-up, no scaling by sets / load / goals. Skippable immediately.
 * Never blocks taps (skip control stays interactive).
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
    }, SESSION_COMPLETE_BURST_MS)
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
        <span className="rg-session-burst__circle" />
        <svg className="rg-session-burst__check-svg" viewBox="0 0 48 48">
          <path
            className="rg-session-burst__check-path"
            d="M12 24.5 L20.5 33 L36 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {Array.from({ length: 6 }, (_, i) => (
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
