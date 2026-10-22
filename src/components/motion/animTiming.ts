/**
 * Debug / capture slow-motion for team animations.
 * Set `document.documentElement.dataset.rgAnimSlow = "4"` (or any positive number)
 * to stretch CSS tokens + JS finish timers together.
 */

export function getAnimSlowFactor(): number {
  if (typeof document === 'undefined') return 1
  const raw = document.documentElement.getAttribute('data-rg-anim-slow')
  if (raw == null || raw === '') return 1
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/** Scale a base ms duration by the current `--rg-anim-slow` / data attribute factor. */
export function animMs(baseMs: number): number {
  return Math.round(baseMs * getAnimSlowFactor())
}
