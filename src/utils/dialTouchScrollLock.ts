/**
 * WKWebView / iOS: block page scroll while the sleep dial is being dragged.
 * Must register touchmove with `{ passive: false }` so preventDefault() works.
 */
export function attachDialTouchScrollLock(
  el: HTMLElement,
  isDragging: () => boolean,
): () => void {
  const onTouchMove = (event: TouchEvent) => {
    if (!isDragging()) return
    if (event.cancelable) event.preventDefault()
  }
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  return () => {
    el.removeEventListener('touchmove', onTouchMove)
  }
}
