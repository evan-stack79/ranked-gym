import { useEffect, useRef, useState, type RefObject } from 'react'

export interface UseInViewOnceOptions {
  /** Skip observation and treat as already visible (e.g. reduced motion). */
  instant?: boolean
  rootMargin?: string
  threshold?: number | number[]
}

/**
 * Border-box vs viewport check that ignores paint clipping (clip-path / overflow).
 * IntersectionObserver can report ratio 0 for fully clip-path'd targets even when
 * the layout box is on-screen — which leaves Reveal stuck at inset(100%).
 */
export function isLayoutBoxInView(
  el: Element,
  options: { rootMarginBottomPct?: number; threshold?: number } = {},
): boolean {
  const { rootMarginBottomPct = 6, threshold = 0.12 } = options
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const vh = window.innerHeight || document.documentElement.clientHeight
  const vw = window.innerWidth || document.documentElement.clientWidth
  const rootTop = 0
  const rootLeft = 0
  const rootBottom = vh * (1 - rootMarginBottomPct / 100)
  const rootRight = vw

  const overlapTop = Math.max(rootTop, rect.top)
  const overlapBottom = Math.min(rootBottom, rect.bottom)
  const overlapLeft = Math.max(rootLeft, rect.left)
  const overlapRight = Math.min(rootRight, rect.right)
  const overlapH = Math.max(0, overlapBottom - overlapTop)
  const overlapW = Math.max(0, overlapRight - overlapLeft)
  const overlapArea = overlapH * overlapW
  const elArea = rect.height * rect.width
  return elArea > 0 && overlapArea / elArea >= threshold
}

function parseBottomMarginPercent(rootMargin: string): number {
  // Supports the hook default `0px 0px -6% 0px` (bottom shrink).
  const parts = rootMargin.trim().split(/\s+/)
  const bottom = parts.length >= 3 ? parts[2]! : parts[0] ?? '0px'
  const m = bottom.match(/^(-?\d+(?:\.\d+)?)%$/)
  if (!m) return 0
  const value = Number(m[1])
  // Negative % on bottom = inset into the root (shrink).
  return value < 0 ? Math.abs(value) : 0
}

function resolveThreshold(threshold: number | number[]): number {
  if (Array.isArray(threshold)) {
    return threshold.length ? Math.min(...threshold) : 0
  }
  return threshold
}

/**
 * Fires once when the element intersects the viewport.
 * Used by Reveal / BlurInText — never re-animates on scroll-back.
 */
export function useInViewOnce<T extends Element = HTMLElement>(
  options: UseInViewOnceOptions = {},
): { ref: RefObject<T | null>; inView: boolean } {
  const { instant = false, rootMargin = '0px 0px -6% 0px', threshold = 0.12 } = options
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(instant)

  useEffect(() => {
    if (instant) {
      setInView(true)
      return
    }

    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    let done = false
    const markIn = () => {
      if (done) return
      done = true
      setInView(true)
      io.disconnect()
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !done) {
            markIn()
            break
          }
        }
      },
      { root: null, rootMargin, threshold },
    )

    io.observe(el)

    // Fallback: clip-path on the target (or delayed layout after remount) can
    // make the observer fire with ratio 0 / never flip isIntersecting. After
    // paint, trust the layout box against the viewport.
    const bottomPct = parseBottomMarginPercent(rootMargin)
    const minRatio = resolveThreshold(threshold)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (done) return
        if (isLayoutBoxInView(el, { rootMarginBottomPct: bottomPct, threshold: minRatio })) {
          markIn()
        }
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      io.disconnect()
    }
  }, [instant, rootMargin, threshold])

  return { ref, inView }
}
