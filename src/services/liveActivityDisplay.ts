/**
 * Display rules mirrored by RestTimerLiveActivityWidget.swift
 * (session bars + rest « ensuite » copy). Pure helpers for vitest.
 */

/** Red bars filled for current series (1-based setIndex). S2/4 → 2 bars. */
export function sessionFilledSetBars(setIndex: number, setTotal: number): number {
  const total = Math.max(1, Math.round(setTotal))
  const current = Math.max(0, Math.round(setIndex))
  return Math.max(0, Math.min(total, current))
}

/**
 * Rest header under the island / lock screen.
 * setIndex = next series (1-based). Never returns « N+1 sur N ».
 */
export function restNextSeriesLabel(setIndex: number, setTotal: number): string {
  const total = Math.max(1, Math.round(setTotal))
  const next = Math.max(1, Math.round(setIndex))
  if (next > total) {
    return 'Séries terminées'
  }
  return `Série ${next} sur ${total} ensuite`
}
