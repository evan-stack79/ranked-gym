/** Défaut Ranked Gym déjà utilisé par le minuteur (`REST_PRESETS_SEC[1]`). */
export const CANONICAL_REST_SEC = 90

export const REST_SEC_MIN = 15
export const REST_SEC_MAX = 600

export function clampRestSec(value: number): number {
  if (!Number.isFinite(value)) return CANONICAL_REST_SEC
  return Math.max(REST_SEC_MIN, Math.min(REST_SEC_MAX, Math.round(value)))
}

/**
 * Durée de récupération — ordre strict :
 * 1. durée configurée exercice / séance
 * 2. préférence utilisateur persistée
 * 3. défaut canonique Ranked Gym (90 s)
 */
export function resolveRestDuration(input: {
  exerciseRestSec?: number | null
  sessionRestSec?: number | null
  preferredRestSec?: number | null
}): number {
  const ordered = [input.exerciseRestSec, input.sessionRestSec, input.preferredRestSec]
  for (const value of ordered) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return clampRestSec(value)
    }
  }
  return CANONICAL_REST_SEC
}
