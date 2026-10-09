/**
 * Single source of truth for the weekly-goal progress bar fill.
 * Text (`done/target`) and `scaleX` must always use this ratio.
 */
export function weeklyGoalFillRatio(doneCount: number, target: number): number {
  if (!Number.isFinite(doneCount) || !Number.isFinite(target) || target <= 0) return 0
  const done = Math.max(0, doneCount)
  return Math.min(1, done / target)
}

export function weeklyGoalReached(doneCount: number, target: number): boolean {
  return target > 0 && doneCount >= target
}
