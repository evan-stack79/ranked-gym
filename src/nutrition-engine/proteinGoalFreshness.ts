import { muscleFreshness, type FreshnessEvent } from '../progression-engine/freshness.ts'

/** Demi-vie × 0,9 dès que protein_goal est débloqué pour ce dateKey. */
export const PROTEIN_GOAL_HALF_LIFE_FACTOR = 0.9

export function halfLifeFactorForProteinGoal(unlocked: boolean): number {
  return unlocked ? PROTEIN_GOAL_HALF_LIFE_FACTOR : 1
}

/**
 * Le bonus s’applique à toutes les séances du même dateKey, que le repas
 * soit loggé avant ou après. La préparation n’est pas recalculée.
 */
export function applyProteinGoalToDay(input: {
  preparation: number | null
  events: FreshnessEvent[]
  proteinGoalUnlocked: boolean
}): {
  preparation: number | null
  freshnessHalfLifeFactor: number
  muscleFreshness: Record<string, number> | null
} {
  const freshnessHalfLifeFactor = halfLifeFactorForProteinGoal(input.proteinGoalUnlocked)
  return {
    preparation: input.preparation,
    freshnessHalfLifeFactor,
    muscleFreshness: muscleFreshness(input.events, { halfLifeFactor: freshnessHalfLifeFactor }),
  }
}
