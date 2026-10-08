/**
 * Accueil in-place edit gestures — long-press enter + drag reorder helpers.
 * Pure functions; no React. Pointer-based, no new dependency.
 */

export const ACCUEIL_LONG_PRESS_MS = 500
/** Finger travel beyond this cancels long-press (scroll / carousel swipe). */
export const ACCUEIL_LONG_PRESS_MOVE_PX = 10

export function movementExceedsThreshold(
  startX: number,
  startY: number,
  x: number,
  y: number,
  thresholdPx = ACCUEIL_LONG_PRESS_MOVE_PX,
): boolean {
  const dx = x - startX
  const dy = y - startY
  return dx * dx + dy * dy > thresholdPx * thresholdPx
}

/**
 * Decide whether a pointer sequence should enter edit mode.
 * Requires: held ≥ longPressMs AND never moved beyond movePx.
 */
export function shouldEnterEditFromLongPress(input: {
  heldMs: number
  startX: number
  startY: number
  endX: number
  endY: number
  longPressMs?: number
  movePx?: number
}): boolean {
  const longPressMs = input.longPressMs ?? ACCUEIL_LONG_PRESS_MS
  if (input.heldMs < longPressMs) return false
  return !movementExceedsThreshold(
    input.startX,
    input.startY,
    input.endX,
    input.endY,
    input.movePx ?? ACCUEIL_LONG_PRESS_MOVE_PX,
  )
}

export type WidgetHitRect = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

/** Visible widget under a point (center-biased); null if none. */
export function hitTestWidgetId(
  clientX: number,
  clientY: number,
  rects: WidgetHitRect[],
): string | null {
  for (const r of rects) {
    if (
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom
    ) {
      return r.id
    }
  }
  return null
}
