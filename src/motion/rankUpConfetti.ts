import confetti from 'canvas-confetti'
import { readPrefersReducedMotion } from '../utils/prefersReducedMotion'

/** Brand confetti palette — red / white / dark grey (visible on black). */
export const RANK_UP_CONFETTI_COLORS = ['#ff0702', '#ffffff', '#42484c'] as const

export type RankUpConfettiOptions = {
  /** Force skip (tests / reduced-motion override). */
  reducedMotion?: boolean
}

const base = {
  colors: [...RANK_UP_CONFETTI_COLORS],
  disableForReducedMotion: true,
  ticks: 160,
  gravity: 1.1,
  scalar: 0.9,
  shapes: ['square', 'circle'] as ('square' | 'circle')[],
}

function shouldSkip(options: RankUpConfettiOptions): boolean {
  if (options.reducedMotion === true) return true
  if (options.reducedMotion === false) return false
  return readPrefersReducedMotion()
}

/** First salve — center burst. */
export function fireRankUpConfettiSalve1(options: RankUpConfettiOptions = {}): boolean {
  if (shouldSkip(options)) return false
  confetti({
    ...base,
    particleCount: 70,
    spread: 70,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.36 },
  })
  return true
}

/** Second salve — left + right bursts. */
export function fireRankUpConfettiSalve2(options: RankUpConfettiOptions = {}): boolean {
  if (shouldSkip(options)) return false
  confetti({
    ...base,
    particleCount: 45,
    angle: 60,
    spread: 55,
    startVelocity: 50,
    origin: { x: 0, y: 0.62 },
  })
  confetti({
    ...base,
    particleCount: 45,
    angle: 120,
    spread: 55,
    startVelocity: 50,
    origin: { x: 1, y: 0.62 },
  })
  return true
}

/**
 * Two salves: center, then sides after 250 ms.
 * Returns whether confetti was scheduled (false under reduced-motion).
 * Call the returned cancel() on unmount.
 */
export function fireRankUpConfetti(options: RankUpConfettiOptions = {}): {
  launched: boolean
  cancel: () => void
} {
  if (shouldSkip(options)) {
    return { launched: false, cancel: () => undefined }
  }
  fireRankUpConfettiSalve1({ reducedMotion: false })
  const id = window.setTimeout(() => {
    fireRankUpConfettiSalve2({ reducedMotion: false })
  }, 250)
  return {
    launched: true,
    cancel: () => window.clearTimeout(id),
  }
}
