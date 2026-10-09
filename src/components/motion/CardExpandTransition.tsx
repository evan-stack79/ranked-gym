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

/**
 * App Store–style: tapped card grows into the full page, then hands off.
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

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onCompleteRef.current()
  }, [])

  useEffect(() => {
    if (!from) {
      doneRef.current = false
      setExpanded(false)
      return
    }
    doneRef.current = false
    if (reduced) {
      finish()
      return
    }
    const raf = window.requestAnimationFrame(() => setExpanded(true))
    const id = window.setTimeout(finish, CARD_EXPAND_MS)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(id)
    }
  }, [from, reduced, finish])

  if (!from || reduced) return null

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
