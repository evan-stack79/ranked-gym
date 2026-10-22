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
 * Rest header. `setIndex` = next series (1-based).
 * - Unknown total (≤0) → null (hide line — never fake « … sur 1 » / « Séries terminées »).
 * - next > total → « Séries terminées » (never « N+1 sur N » / inflated total).
 * - else → « Série X sur Y ensuite » with X clamped to Y.
 */
export function restNextSeriesLabel(
  setIndex: number,
  setTotal: number | null | undefined,
): string | null {
  if (setTotal == null || !Number.isFinite(setTotal) || setTotal <= 0) {
    return null
  }
  const total = Math.round(setTotal)
  const next = Math.max(1, Math.round(setIndex))
  if (next > total) {
    return 'Séries terminées'
  }
  const x = Math.min(next, total)
  return `Série ${x} sur ${total} ensuite`
}

/** « 6 240 » — espace fine milliers (maquette pas). */
export function formatStepsCount(steps: number): string {
  const n = Math.max(0, Math.round(steps))
  return n.toLocaleString('fr-FR')
}
