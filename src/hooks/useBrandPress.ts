import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { pressIn, pressOut } from '../motion/brandPress'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Pointer press scale for primary brand buttons (motion/mini).
 * Reduced-motion: opacity pulse only — no scale.
 */
export function useBrandPress<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T | null>(null)
  const reduced = usePrefersReducedMotion()
  const pressedRef = useRef(false)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<T>) => {
      if (e.button != null && e.button !== 0) return
      const el = ref.current
      if (!el || el.hasAttribute('disabled')) return
      pressedRef.current = true
      el.dataset.pressed = 'true'
      void pressIn(el, reduced)
    },
    [reduced],
  )

  const release = useCallback(() => {
    if (!pressedRef.current) return
    pressedRef.current = false
    const el = ref.current
    if (!el) return
    delete el.dataset.pressed
    void pressOut(el, reduced)
  }, [reduced])

  return {
    ref,
    pressProps: {
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
    } as const,
  }
}
