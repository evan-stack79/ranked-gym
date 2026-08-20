import type { NutritionGoal } from '../types/nutrition'

/** Rough walking/running cost from steps (weight-aware). */
export function stepsToKcal(steps: number, weightKg: number): number {
  if (steps <= 0) return 0
  return Math.round(steps * Math.max(50, weightKg) * 0.00045)
}

/**
 * How much of burned activity we add back to the daily food target.
 * Cut: eat back only part (still in deficit). Bulk: eat most back to recover/grow.
 */
export function activityEatBackFactor(goal: NutritionGoal): number {
  if (goal === 'cut') return 0.45
  if (goal === 'bulk') return 0.95
  return 0.75
}

export function applyActivityToTarget(
  baseTarget: number,
  goal: NutritionGoal,
  activityKcal: number,
): { targetCalories: number; activityBonus: number; burned: number } {
  const burned = Math.max(0, Math.round(activityKcal))
  const activityBonus = Math.round(burned * activityEatBackFactor(goal))
  return {
    burned,
    activityBonus,
    targetCalories: Math.max(1200, baseTarget + activityBonus),
  }
}

export function estimateSessionKcal(
  durationMin: number,
  kcalPerHour: number,
  weightKg: number,
): number {
  const weightFactor = weightKg / 70
  return Math.round((durationMin / 60) * kcalPerHour * weightFactor)
}
