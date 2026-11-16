/** Chart helpers for « Ta semaine » bar card (maquette apres.html). */

export const SLEEP_WEEK_CHART_H_PX = 132
/** Scale: full height = 10 h (maquette). */
export const SLEEP_WEEK_CHART_MAX_MIN = 10 * 60
export const SLEEP_WEEK_BAR_RECORDED = '#6e1a18'
export const SLEEP_WEEK_BAR_SELECTED = '#ff0702'

export function barHeightPx(durationMin: number): number {
  const clamped = Math.max(0, Math.min(SLEEP_WEEK_CHART_MAX_MIN, durationMin))
  return (clamped / SLEEP_WEEK_CHART_MAX_MIN) * SLEEP_WEEK_CHART_H_PX
}

export function repereBottomPx(repereMin: number): number {
  return barHeightPx(repereMin)
}

/**
 * Empty night → dashed stub (past), never a 0-height bar.
 * Future nights / no figure → empty (no stub, no bar).
 */
export function chartSlotKind(
  durationMin: number | null | undefined,
  opts?: { future?: boolean; emptyUnrecorded?: boolean },
): 'bar' | 'stub' | 'empty' {
  if (opts?.future) return 'empty'
  if (durationMin != null && durationMin > 0) return 'bar'
  if (opts?.emptyUnrecorded) return 'empty'
  return 'stub'
}

export function formatBarDurationLabel(durationMin: number): string {
  const rounded = Math.round(durationMin / 5) * 5
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function nightsSurSeptLabel(validCount: number): string {
  const n = Math.max(0, Math.min(7, Math.floor(validCount)))
  return `par nuit · ${n} nuit${n > 1 ? 's' : ''} sur 7`
}
