/**
 * Interruptible FLIP helpers for Accueil edit reorder.
 * GPU-only (transform); First = visual position, Last = layout after clearing transforms.
 */

export const ACCUEIL_FLIP_MS = 220
export const ACCUEIL_DROP_MS = 200
export const ACCUEIL_ENTER_MS = 220
export const ACCUEIL_EXIT_MS = 180

/** Strong ease-out — matches --ease-out in index.css. */
export const ACCUEIL_FLIP_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)'

export type FlipPoint = { left: number; top: number }

export function flipDelta(first: FlipPoint, last: FlipPoint): { dx: number; dy: number } {
  return { dx: first.left - last.left, dy: first.top - last.top }
}

export function shouldAnimateFlip(dx: number, dy: number, thresholdPx = 0.5): boolean {
  return Math.abs(dx) >= thresholdPx || Math.abs(dy) >= thresholdPx
}

export function cancelElementAnimations(el: Element): void {
  if (typeof (el as HTMLElement).getAnimations !== 'function') return
  for (const anim of (el as HTMLElement).getAnimations()) {
    try {
      anim.cancel()
    } catch {
      /* ignore */
    }
  }
}

/** Read visual rects (includes in-flight transforms) keyed by data-accueil-edit-slot. */
export function captureSlotRects(root: HTMLElement): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>()
  for (const el of root.querySelectorAll('[data-accueil-edit-slot]')) {
    const id = el.getAttribute('data-accueil-edit-slot')
    if (id) map.set(id, el.getBoundingClientRect())
  }
  return map
}

export type PlayFlipOptions = {
  ms?: number
  easing?: string
  fromScale?: number
  toScale?: number
  /** Also fade opacity (enter/exit helpers); default false. */
  fromOpacity?: number
  toOpacity?: number
}

/**
 * Invert→Play translate (and optional scale/opacity) via WAAPI.
 * Cancels any in-flight animation on `el` first so a mid-FLIP reorder
 * continues from the current visual position with no jump.
 */
export function playFlipTranslate(
  el: HTMLElement,
  dx: number,
  dy: number,
  options: PlayFlipOptions = {},
): Animation | null {
  const ms = options.ms ?? ACCUEIL_FLIP_MS
  const easing = options.easing ?? ACCUEIL_FLIP_EASING
  const fromScale = options.fromScale ?? 1
  const toScale = options.toScale ?? 1
  const fromOpacity = options.fromOpacity
  const toOpacity = options.toOpacity
  const scaleChanged = fromScale !== toScale
  const opacityChanged =
    fromOpacity != null && toOpacity != null && fromOpacity !== toOpacity

  if (!shouldAnimateFlip(dx, dy) && !scaleChanged && !opacityChanged) {
    el.style.transform = ''
    el.style.opacity = ''
    return null
  }

  cancelElementAnimations(el)
  el.style.transition = 'none'
  el.style.transform = ''

  if (typeof el.animate !== 'function') {
    // jsdom / ancient engines — snap to rest (reduced-motion equivalent).
    el.style.transform = ''
    el.style.opacity = ''
    return null
  }

  const from: Keyframe = {
    transform: `translate3d(${dx}px, ${dy}px, 0) scale(${fromScale})`,
  }
  const to: Keyframe = {
    transform: `translate3d(0, 0, 0) scale(${toScale})`,
  }
  if (opacityChanged) {
    from.opacity = fromOpacity
    to.opacity = toOpacity
  }

  const anim = el.animate([from, to], {
    duration: ms,
    easing,
    fill: 'both',
  })

  const clear = () => {
    try {
      anim.cancel()
    } catch {
      /* ignore */
    }
    el.style.transform = ''
    el.style.opacity = ''
    el.style.transition = ''
  }

  anim.finished.then(clear).catch(clear)
  return anim
}

export type RunFlipOptions = {
  skipId?: string | null
  ms?: number
}

/**
 * After a layout change: for each slot present in `first`, clear transforms,
 * measure Last, and animate Invert→Play. Interruptible / re-entrant.
 */
export function runFlipFromFirst(
  root: HTMLElement,
  first: Map<string, DOMRect>,
  options: RunFlipOptions = {},
): void {
  const ms = options.ms ?? ACCUEIL_FLIP_MS
  const slots = [...root.querySelectorAll<HTMLElement>('[data-accueil-edit-slot]')]
  for (const el of slots) {
    const id = el.getAttribute('data-accueil-edit-slot')
    if (!id || id === options.skipId) continue
    const prev = first.get(id)
    if (!prev) continue

    // Clear in-flight FLIP so Last is pure layout (not visual+transform).
    cancelElementAnimations(el)
    el.style.transition = 'none'
    el.style.transform = 'none'
    // Force layout so getBoundingClientRect reflects cleared transform.
    void el.offsetWidth
    const last = el.getBoundingClientRect()
    el.style.transform = ''

    const { dx, dy } = flipDelta(prev, last)
    if (!shouldAnimateFlip(dx, dy)) continue
    el.style.zIndex = '2'
    const anim = playFlipTranslate(el, dx, dy, { ms })
    if (anim) {
      anim.finished
        .then(() => {
          el.style.zIndex = ''
        })
        .catch(() => {
          el.style.zIndex = ''
        })
    } else {
      el.style.zIndex = ''
    }
  }
}
