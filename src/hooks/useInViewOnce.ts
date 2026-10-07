import { useEffect, useRef, useState, type RefObject } from 'react'

export interface UseInViewOnceOptions {
  /** Skip observation and treat as already visible (e.g. reduced motion). */
  instant?: boolean
  rootMargin?: string
  threshold?: number | number[]
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !done) {
            done = true
            setInView(true)
            io.disconnect()
            break
          }
        }
      },
      { root: null, rootMargin, threshold },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [instant, rootMargin, threshold])

  return { ref, inView }
}
