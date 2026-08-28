/** Capacité V1 d'une bouteille active (ml) — alignée sur WATER_BOTTLE_CAPACITY_ML. */
export const BOTTLE_CAPACITY_ML = 1500

export interface BottleProgress {
  completedCount: number
  activeMl: number
  activeProgress: number
  goalReached: boolean
  overGoalMl: number
  showActiveBottle: boolean
}

function sanitizeMl(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function sanitizeCapacity(value: number): number {
  const cap = sanitizeMl(value)
  return cap > 0 ? cap : BOTTLE_CAPACITY_ML
}

/**
 * Dérive l'état visuel des bouteilles depuis le journal réel.
 * `waterBottleLevelMl` (legacy) n'est pas utilisé — uniquement consumedMl + objectif.
 */
export function deriveBottleProgress(
  consumedMl: number,
  goalMl: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): BottleProgress {
  const consumed = sanitizeMl(consumedMl)
  const goal = sanitizeMl(goalMl)
  const capacity = sanitizeCapacity(capacityMl)

  const completedCount = Math.floor(consumed / capacity)
  const activeMl = consumed % capacity
  const activeProgress = capacity > 0 ? activeMl / capacity : 0
  const goalReached = goal > 0 && consumed >= goal
  const overGoalMl = goal > 0 ? Math.max(0, consumed - goal) : 0
  const showActiveBottle = !goalReached || activeMl > 0

  return {
    completedCount,
    activeMl,
    activeProgress,
    goalReached,
    overGoalMl,
    showActiveBottle,
  }
}
