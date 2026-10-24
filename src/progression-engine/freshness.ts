import {
  HALF_LIFE_LARGE_HOURS,
  HALF_LIFE_MEDIUM_HOURS,
  HALF_LIFE_SMALL_HOURS,
  MUSCLE_PRIMARY_SHARE,
  MUSCLE_SECONDARY_SHARE,
} from './constants.ts'
import type { MuscleShare, StrengthSetInput } from './types.ts'
import { isDoneSet, setStrainUnits } from './strain.ts'

const SMALL = new Set(['Biceps', 'Triceps', 'Épaules', 'Mollets'])
const LARGE = new Set(['Quadriceps', 'Ischios'])

export function halfLifeHours(muscle: string): number {
  if (SMALL.has(muscle)) return HALF_LIFE_SMALL_HOURS
  if (LARGE.has(muscle)) return HALF_LIFE_LARGE_HOURS
  return HALF_LIFE_MEDIUM_HOURS
}

/** 100 % si un seul muscle. 70/30 seulement s’il existe au moins un secondaire. */
export function muscleShares(muscles: string[]): MuscleShare[] {
  const unique: string[] = []
  for (const muscle of muscles) {
    const name = muscle.trim()
    if (!name || unique.includes(name)) continue
    unique.push(name)
  }
  if (unique.length === 0) return []
  if (unique.length === 1) return [{ muscle: unique[0], share: 1 }]
  const secondary = MUSCLE_SECONDARY_SHARE / (unique.length - 1)
  return unique.map((muscle, index) => ({
    muscle,
    share: index === 0 ? MUSCLE_PRIMARY_SHARE : secondary,
  }))
}

export interface FreshnessEvent {
  muscles: string[]
  units: number
  hoursAgo: number
}

/**
 * Sans aucun événement, null — pas 100.
 * Capacité = charge cumulée du muscle. Résidu = charge × exp(−heures / demi-vie).
 * `halfLifeFactor` 0,9 raccourcit la demi-vie (protein_goal) : le résidu baisse, la fraîcheur monte.
 */
export function muscleFreshness(
  events: FreshnessEvent[],
  options?: { halfLifeFactor?: number },
): Record<string, number> | null {
  const requested = options?.halfLifeFactor
  const factor = requested != null && Number.isFinite(requested) && requested > 0 ? requested : 1
  if (events.length === 0) return null
  const residual = new Map<string, number>()
  const capacity = new Map<string, number>()
  for (const event of events) {
    if (!Number.isFinite(event.units) || event.units <= 0) continue
    if (!Number.isFinite(event.hoursAgo) || event.hoursAgo < 0) continue
    for (const { muscle, share } of muscleShares(event.muscles)) {
      const load = event.units * share
      const decay = Math.exp(-event.hoursAgo / (halfLifeHours(muscle) * factor))
      residual.set(muscle, (residual.get(muscle) ?? 0) + load * decay)
      capacity.set(muscle, (capacity.get(muscle) ?? 0) + load)
    }
  }
  if (capacity.size === 0) return null
  const out: Record<string, number> = {}
  for (const [muscle, cap] of capacity) {
    if (cap <= 0) continue
    const fresh = 100 * (1 - (residual.get(muscle) ?? 0) / cap)
    out[muscle] = Math.round(Math.min(100, Math.max(0, fresh)))
  }
  return Object.keys(out).length > 0 ? out : null
}

export function freshnessEventsFromSets(
  sets: StrengthSetInput[],
  bodyweightKg: number | null | undefined,
  hoursAgo: number,
): FreshnessEvent[] {
  const events: FreshnessEvent[] = []
  for (const set of sets) {
    if (!isDoneSet(set)) continue
    const units = setStrainUnits(set, bodyweightKg)
    if (units == null || units <= 0) continue
    events.push({ muscles: set.muscles ?? [], units, hoursAgo })
  }
  return events
}
