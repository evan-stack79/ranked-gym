import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const TILT_MAX_DEG = 7
export const TILT_ACTIVE_SCALE = 1.015
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
}

function clearTiltVars(plane: HTMLElement) {
  plane.style.setProperty('--rx', '0deg')
  plane.style.setProperty('--ry', '0deg')
  plane.style.setProperty('--gx', '50%')
  plane.style.setProperty('--gy', '50%')
  plane.style.setProperty('--tilt-scale', '1')
}

/**
 * Subtle 3D tilt + glare for Accueil hero cards.
 * Writes CSS vars via rAF (no React state per move). Does not preventDefault
 * on touch — horizontal carousel swipe still wins past a small threshold.
 * Transform lives on an inner plane so Reveal / clip-path stay untouched.
 */
export function TiltCard({ children, className = '', disabled = false }: TiltCardProps) {
  const reduced = usePrefersReducedMotion()
  const off = disabled || reduced

  const rootRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)
  const activeRef = useRef(false)
  const cancelledRef = useRef(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const touchTrackingRef = useRef(false)

  const setActiveClass = (on: boolean) => {
    const root = rootRef.current
    if (!root) return
    root.classList.toggle('rg-tilt--active', on)
    root.dataset.rgTiltActive = on ? '1' : '0'
  }

  const resetTilt = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pendingRef.current = null
    activeRef.current = false
    touchTrackingRef.current = false
    startRef.current = null
    const plane = planeRef.current
    if (plane) clearTiltVars(plane)
    setActiveClass(false)
  }

  const flushTilt = () => {
    rafRef.current = 0
    const pending = pendingRef.current
    const plane = planeRef.current
    if (!pending || !plane || cancelledRef.current) return
    const rect = plane.getBoundingClientRect()
    const vars = computeTiltVars(pending.x, pending.y, rect)
    applyTiltVars(plane, vars, TILT_ACTIVE_SCALE)
    if (!activeRef.current) {
      activeRef.current = true
      setActiveClass(true)
    }
  }

  const scheduleTilt = (clientX: number, clientY: number) => {
    if (off || cancelledRef.current) return
    pendingRef.current = { x: clientX, y: clientY }
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(flushTilt)
  }

  useEffect(() => {
    if (off) return

    const root = rootRef.current
    const scroller = closestHorizontalScroller(root)
    if (!scroller) return

    const onScroll = () => {
      if (!activeRef.current && !touchTrackingRef.current) return
      cancelledRef.current = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      pendingRef.current = null
      activeRef.current = false
      touchTrackingRef.current = false
      startRef.current = null
      const plane = planeRef.current
      if (plane) clearTiltVars(plane)
      root?.classList.remove('rg-tilt--active')
      if (root) root.dataset.rgTiltActive = '0'
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [off])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  if (off) {
    return (
      <div className={['rg-tilt', className].filter(Boolean).join(' ')} data-rg-tilt="off">
        <div className="rg-tilt__plane">{children}</div>
      </div>
    )
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      cancelledRef.current = false
      touchTrackingRef.current = true
      startRef.current = { x: event.clientX, y: event.clientY }
      scheduleTilt(event.clientX, event.clientY)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (!touchTrackingRef.current || cancelledRef.current) return
      const start = startRef.current
      if (start) {
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dx) > TILT_SWIPE_CANCEL_PX && Math.abs(dx) > Math.abs(dy)) {
          cancelledRef.current = true
          resetTilt()
          return
        }
      }
      scheduleTilt(event.clientX, event.clientY)
      return
    }

    // Desktop: hover tilt (no press required)
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      cancelledRef.current = false
      scheduleTilt(event.clientX, event.clientY)
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      cancelledRef.current = false
      resetTilt()
    }
  }

  const onPointerCancel = () => {
    cancelledRef.current = false
    resetTilt()
  }

  const onPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      resetTilt()
    }
  }

  const planeStyle = {
    '--rx': '0deg',
    '--ry': '0deg',
    '--gx': '50%',
    '--gy': '50%',
    '--tilt-scale': '1',
    '--tilt-reset-ms': `${TILT_RESET_MS}ms`,
  } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={['rg-tilt', className].filter(Boolean).join(' ')}
      data-rg-tilt="on"
      data-rg-tilt-active="0"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      <div ref={planeRef} className="rg-tilt__plane" style={planeStyle} data-rg-tilt-plane>
        {children}
        <span className="rg-tilt__glare" data-rg-tilt-glare aria-hidden="true" />
      </div>
    </div>
  )
}
