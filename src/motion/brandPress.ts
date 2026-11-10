import { animate } from 'motion/mini'
import { readPrefersReducedMotion } from '../utils/prefersReducedMotion'

/** Press-in: scale 0.96 in ~90 ms (or opacity pulse under reduced-motion). */
export function pressIn(el: HTMLElement, reduced = readPrefersReducedMotion()) {
  if (reduced) {
    return animate(el, { opacity: 0.85 }, { duration: 0.08 })
  }
  return animate(
    el,
    { transform: 'scale(0.96)' },
    { duration: 0.09, ease: [0.23, 1, 0.32, 1] },
  )
}

/** Press-out: spring back ~180 ms (or opacity restore under reduced-motion). */
export function pressOut(el: HTMLElement, reduced = readPrefersReducedMotion()) {
  if (reduced) {
    return animate(el, { opacity: 1 }, { duration: 0.12 })
  }
  return animate(
    el,
    { transform: 'scale(1)' },
    { type: 'spring', visualDuration: 0.18, bounce: 0.35 },
  )
}
