import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const TILT_MAX_DEG = 8
export const TILT_ACTIVE_SCALE = 1.02
/** Horizontal move beyond this cancels tilt so the carousel can swipe. */
export const TILT_SWIPE_CANCEL_PX = 12
export const TILT_RESET_MS = 360

export interface TiltCardProps {
  children: ReactNode
  className?: string
  /** Force-disable (tests / feature gates). */
  disabled?: boolean
}

export interface TiltVars {
  rx: number
  ry: number
  gx: number
  gy: number
}

/** Map pointer position inside a rect to subtle rotate + glare %. */
export function computeTiltVars(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  maxDeg = TILT_MAX_DEG,
): TiltVars {
  const w = Math.max(rect.width, 1)
  const h = Math.max(rect.height, 1)
  const px = (clientX - rect.left) / w
  const py = (clientY - rect.top) / h
  const clampedX = Math.min(1, Math.max(0, px))
  const clampedY = Math.min(1, Math.max(0, py))
  return {
    ry: (clampedX - 0.5) * 2 * maxDeg,
    rx: (0.5 - clampedY) * 2 * maxDeg,
    gx: clampedX * 100,
    gy: clampedY * 100,
  }
}

function closestHorizontalScroller(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    if (node.hasAttribute('data-accueil-carousel')) return node
    const { overflowX } = window.getComputedStyle(node)
    if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

function applyTiltVars(plane: HTMLElement, vars: TiltVars, scale: number) {
  plane.style.setProperty('--rx', `${vars.rx.toFixed(3)}deg`)
  plane.style.setProperty('--ry', `${vars.ry.toFixed(3)}deg`)
  plane.style.setProperty('--gx', `${vars.gx.toFixed(2)}%`)
  plane.style.setProperty('--gy', `${vars.gy.toFixed(2)}%`)
  plane.style.setProperty('--tilt-scale', String(scale))
  // Soft depth cue (px) — helps the 3D read without raising degrees
  plane.style.setProperty('--sx', `${(vars.ry * 0.55).toFixed(2)}px`)
  plane.style.setProperty('--sy', `${(-vars.rx * 0.55).toFixed(2)}px`)
}

function clearTiltVars(plane: HTMLElement) {
  plane.style.setProperty('--rx', '0deg')
  plane.style.setProperty('--ry', '0deg')
  plane.style.setProperty('--gx', '50%')
  plane.style.setProperty('--gy', '50%')
  plane.style.setProperty('--tilt-scale', '1')
  plane.style.setProperty('--sx', '0px')
  plane.style.setProperty('--sy', '0px')
}

/**
 * Subtle 3D tilt + glare for Accueil hero cards.
 * Writes CSS vars via rAF (no React state per move). Native pointer listeners
 * (not React synthetic) so Playwright / touch sims work. Never preventDefault
 * and never setPointerCapture — vertical page scroll and horizontal carousel
 * swipe must stay with the browser. Past a small threshold, dominant vertical
 * or horizontal motion drops the tilt (iOS may also fire pointercancel).
 * Transform lives on an inner plane so Reveal / clip-path stay untouched (#95).
 */
export function TiltCard({ children, className = '', disabled = false }: TiltCardProps) {
  const reduced = usePrefersReducedMotion()
  const off = disabled || reduced

  const rootRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const plane = planeRef.current
    if (!root || !plane || off) return

    let rafId = 0
    let pending: { x: number; y: number } | null = null
    let active = false
    let cancelled = false
    let touchTracking = false
    let start: { x: number; y: number } | null = null

    const setActiveClass = (on: boolean) => {
      root.classList.toggle('rg-tilt--active', on)
      root.dataset.rgTiltActive = on ? '1' : '0'
    }

    const resetTilt = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      pending = null
      active = false
      touchTracking = false
      start = null
      clearTiltVars(plane)
      setActiveClass(false)
    }

    const flushTilt = () => {
      rafId = 0
      if (!pending || cancelled) return
      const rect = plane.getBoundingClientRect()
      const vars = computeTiltVars(pending.x, pending.y, rect)
      applyTiltVars(plane, vars, TILT_ACTIVE_SCALE)
      if (!active) {
        active = true
        setActiveClass(true)
      }
    }

    const scheduleTilt = (clientX: number, clientY: number) => {
      if (cancelled) return
      pending = { x: clientX, y: clientY }
      if (rafId) return
      rafId = requestAnimationFrame(flushTilt)
    }

    /** Drop tilt when the gesture is clearly a scroll/swipe, never block it. */
    const shouldCancelForScroll = (dx: number, dy: number) => {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX <= TILT_SWIPE_CANCEL_PX && absY <= TILT_SWIPE_CANCEL_PX) return false
      // Vertical-dominant → let Accueil page scroll
      if (absY >= absX) return true
      // Horizontal-dominant → let carousel swipe
      return absX > TILT_SWIPE_CANCEL_PX
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      // Do not setPointerCapture — that would eat vertical scroll on iOS.
      cancelled = false
      touchTracking = true
      start = { x: event.clientX, y: event.clientY }
      scheduleTilt(event.clientX, event.clientY)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        if (!touchTracking || cancelled) return
        // Never preventDefault — vertical pan must reach the scroll container.
        if (start) {
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (shouldCancelForScroll(dx, dy)) {
            cancelled = true
            resetTilt()
            return
          }
        }
        scheduleTilt(event.clientX, event.clientY)
        return
      }

      if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
        cancelled = false
        scheduleTilt(event.clientX, event.clientY)
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        cancelled = false
        resetTilt()
      }
    }

    // iOS fires pointercancel when the scroll view takes over the gesture.
    const onPointerCancel = () => {
      cancelled = false
      resetTilt()
    }

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
        resetTilt()
      }
    }

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerUp)
    root.addEventListener('pointercancel', onPointerCancel)
    root.addEventListener('pointerleave', onPointerLeave)

    const scroller = closestHorizontalScroller(root)
    const onScroll = () => {
      if (!active && !touchTracking) return
      cancelled = true
      resetTilt()
    }
    scroller?.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerCancel)
      root.removeEventListener('pointerleave', onPointerLeave)
      scroller?.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
      clearTiltVars(plane)
      setActiveClass(false)
    }
  }, [off])

  if (off) {
    return (
      <div className={['rg-tilt', className].filter(Boolean).join(' ')} data-rg-tilt="off">
        <div className="rg-tilt__plane">{children}</div>
      </div>
    )
  }

  const planeStyle = {
    '--rx': '0deg',
    '--ry': '0deg',
    '--gx': '50%',
    '--gy': '50%',
    '--tilt-scale': '1',
    '--sx': '0px',
    '--sy': '0px',
    '--tilt-reset-ms': `${TILT_RESET_MS}ms`,
  } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={['rg-tilt', className].filter(Boolean).join(' ')}
      data-rg-tilt="on"
      data-rg-tilt-active="0"
    >
      <div ref={planeRef} className="rg-tilt__plane" style={planeStyle} data-rg-tilt-plane>
        {children}
        <span className="rg-tilt__glare" data-rg-tilt-glare aria-hidden="true" />
      </div>
    </div>
  )
}
