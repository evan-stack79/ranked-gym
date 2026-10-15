/**
 * iOS Safari: a diagonal swipe on a horizontal scroll-snap carousel often
 * snaps sideways ("bas gauche") while the user meant to scroll the page down.
 *
 * After a small move threshold, lock to the dominant axis:
 * - vertical → temporarily disable horizontal overflow / snap on the carousel
 * - horizontal → leave carousel free; page must not pan sideways (overflow-x: clip)
 *
 * Never preventDefault — native momentum scroll stays with the browser.
 */

export const AXIS_LOCK_MOVE_PX = 8

export type ScrollAxis = 'x' | 'y'

/** Pure: which axis wins once travel exceeds threshold. */
export function resolveScrollAxisLock(
  startX: number,
  startY: number,
  x: number,
  y: number,
  thresholdPx = AXIS_LOCK_MOVE_PX,
): ScrollAxis | null {
  const dx = x - startX
  const dy = y - startY
  if (dx * dx + dy * dy <= thresholdPx * thresholdPx) return null
  return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
}

export type AxisLockHandle = {
  destroy: () => void
}

/**
 * Attach passive pointer listeners that set `data-accueil-axis="x"|"y"` on `el`.
 * CSS should honour `[data-accueil-axis="y"]` by freezing horizontal scroll.
 */
export function attachHorizontalScrollAxisLock(
  el: HTMLElement,
  thresholdPx = AXIS_LOCK_MOVE_PX,
): AxisLockHandle {
  let start: { x: number; y: number; pointerId: number } | null = null
  let locked: ScrollAxis | null = null

  const clear = () => {
    start = null
    locked = null
    delete el.dataset.accueilAxis
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
    locked = null
    delete el.dataset.accueilAxis
  }

  const onMove = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.pointerId || locked) return
    const axis = resolveScrollAxisLock(start.x, start.y, e.clientX, e.clientY, thresholdPx)
    if (!axis) return
    locked = axis
    el.dataset.accueilAxis = axis
  }

  const onUp = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.pointerId) return
    clear()
  }

  el.addEventListener('pointerdown', onDown, { passive: true })
  el.addEventListener('pointermove', onMove, { passive: true })
  el.addEventListener('pointerup', onUp, { passive: true })
  el.addEventListener('pointercancel', onUp, { passive: true })
  el.addEventListener('lostpointercapture', clear)

  return {
    destroy: () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('lostpointercapture', clear)
      clear()
    },
  }
}
