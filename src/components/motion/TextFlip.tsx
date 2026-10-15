import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const GREETING_FLIP_WORDS = ['Prêt', 'Motivé', 'Focus'] as const
export const TEXT_FLIP_INTERVAL_MS = 2500
export const TEXT_FLIP_DUR_MS = 420

export interface TextFlipProps {
  words?: readonly string[]
  className?: string
  /** Cycle interval; default 2500ms. */
  intervalMs?: number
  /**
   * Static word announced to screen readers (and shown under reduced motion).
   * Defaults to the first word (« Prêt »).
   */
  staticWord?: string
}

/**
 * Text Flip — one word cycles with a vertical flip (rotateX).
 * Stable width (measured max). Accessible: sr-only static word, cycling aria-hidden,
 * no aria-live. Pauses when the tab is hidden. Reduced motion → static « Prêt » only.
 */
export function TextFlip({
  words = GREETING_FLIP_WORDS,
  className = '',
  intervalMs = TEXT_FLIP_INTERVAL_MS,
  staticWord,
}: TextFlipProps) {
  const reduced = usePrefersReducedMotion()
  const list = words.length > 0 ? words : GREETING_FLIP_WORDS
  const announced = staticWord ?? list[0] ?? 'Prêt'
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined)
  const measureRef = useRef<HTMLSpanElement>(null)
  const visible = list[index] ?? announced

  useLayoutEffect(() => {
    const host = measureRef.current
    if (!host) return
    let max = 0
    for (const child of Array.from(host.children)) {
      if (child instanceof HTMLElement) {
        max = Math.max(max, child.offsetWidth)
      }
    }
    if (max > 0) setMinWidth(max)
  }, [list])

  useEffect(() => {
    if (reduced || list.length <= 1) return

    let cancelled = false
    let flipTimer: number | null = null
    let cycleTimer: number | null = null

    const clear = () => {
      if (flipTimer != null) window.clearTimeout(flipTimer)
      if (cycleTimer != null) window.clearTimeout(cycleTimer)
      flipTimer = null
      cycleTimer = null
    }

    const scheduleNext = () => {
      clear()
      if (document.hidden || cancelled) return
      cycleTimer = window.setTimeout(() => {
        if (cancelled || document.hidden) return
        setPhase('out')
        flipTimer = window.setTimeout(() => {
          if (cancelled) return
          setIndex((i) => (i + 1) % list.length)
          setPhase('in')
          flipTimer = window.setTimeout(() => {
            if (cancelled) return
            setPhase('idle')
            scheduleNext()
          }, TEXT_FLIP_DUR_MS)
        }, TEXT_FLIP_DUR_MS)
      }, intervalMs)
    }

    const onVisibility = () => {
      if (document.hidden) {
        clear()
        setPhase('idle')
      } else {
        scheduleNext()
      }
    }

    scheduleNext()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced, list, intervalMs])

  if (reduced) {
    return (
      <span
        className={`rg-text-flip rg-text-flip--static ${className}`.trim()}
        data-rg-text-flip="static"
        data-rg-motion="reduced"
      >
        {announced}
      </span>
    )
  }

  return (
    <span
      className={`rg-text-flip ${className}`.trim()}
      data-rg-text-flip="on"
      data-rg-motion="on"
      style={minWidth != null ? { minWidth } : undefined}
    >
      {/* Screen readers: one static word, no aria-live. */}
      <span className="sr-only">{announced}</span>
      <span aria-hidden="true" className="rg-text-flip__viewport">
        <span
          className={`rg-text-flip__word rg-text-flip__word--${phase}`}
          key={`${index}-${visible}`}
        >
          {visible}
        </span>
      </span>
      {/* Off-screen measure row for stable width */}
      <span ref={measureRef} className="rg-text-flip__measure" aria-hidden="true">
        {list.map((w) => (
          <span key={w} className="rg-text-flip__measure-item">
            {w}
          </span>
        ))}
      </span>
    </span>
  )
}
