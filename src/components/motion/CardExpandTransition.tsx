import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { CARD_EXPAND_MS } from './sessionActionGuards'

export type CardExpandRect = {
  top: number
  left: number
  width: number
  height: number
}

export type CardExpandTransitionProps = {
  /** Source card rect in viewport coords. Null = hidden. */
  from: CardExpandRect | null
  onComplete: () => void
  forceReducedMotion?: boolean
}

function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document
}

/**
 * App Store–style card → page.
 * Prefers Chrome same-document View Transitions; falls back to FLIP expand.
 * Reduced-motion / missing rect → onComplete immediately.
 */
export function CardExpandTransition({
  from,
  onComplete,
  forceReducedMotion,
}: CardExpandTransitionProps) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = forceReducedMotion ?? prefersReduced
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [expanded, setExpanded] = useState(false)
  const [useFallback, setUseFallback] = useState(true)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onCompleteRef.current()
  }, [])

  useEffect(() => {
    if (!from) {
      doneRef.current = false
      setExpanded(false)
      setUseFallback(true)
      return
    }
    doneRef.current = false
    if (reduced) {
      finish()
      return
    }

    if (supportsViewTransitions()) {
      setUseFallback(false)
      try {
        const doc = document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> }
        }
        const vt = doc.startViewTransition(() => {
          /* DOM swap is handled by the caller after onComplete. */
        })
        void vt.finished.then(finish).catch(finish)
        const id = window.setTimeout(finish, CARD_EXPAND_MS)
        return () => window.clearTimeout(id)
      } catch {
        setUseFallback(true)
      }
    }

    setUseFallback(true)
    const raf = window.requestAnimationFrame(() => setExpanded(true))
    const id = window.setTimeout(finish, CARD_EXPAND_MS)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(id)
    }
  }, [from, reduced, finish])

  if (!from || reduced || !useFallback) return null

  const style = expanded
    ? {
        top: 0,
        left: 0,
        width: '100dvw',
        height: '100dvh',
        borderRadius: 0,
      }
    : {
        top: from.top,
        left: from.left,
        width: from.width,
        height: from.height,
        borderRadius: 20,
      }

  return createPortal(
    <div
      className={`rg-card-expand${expanded ? ' rg-card-expand--open' : ''}`}
      data-rg-anim="card-expand"
      style={style}
      aria-hidden="true"
    />,
    document.body,
  )
}

/** Read a card’s viewport rect for CardExpandTransition. */
export function readCardExpandRect(el: Element | null): CardExpandRect | null {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (r.width < 8 || r.height < 8) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/** Navigate with View Transitions when available; otherwise call navigate directly. */
export function navigateWithViewTransition(navigate: () => void): void {
  if (typeof document === 'undefined') {
    navigate()
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    navigate()
    return
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(navigate)
    return
  }
  navigate()
}
