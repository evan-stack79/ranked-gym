import { getCalorieProfile } from './nutritionStorage'
import { isMinorOrUnknownAge } from './nutritionSafetyRules'

/**
 * Garde 18+ : entrée UI masquée si âge mineur ou inconnu.
 * Le serveur refuse aussi via `declaredAge` (non stocké).
 */
export function canAccessBetaFeedback(age?: unknown): boolean {
  const resolved = age !== undefined ? age : getCalorieProfile().age
  return !isMinorOrUnknownAge(resolved)
}

export function getDeclaredAgeForAvis(): number | null {
  const age = getCalorieProfile().age
  if (typeof age !== 'number' || !Number.isFinite(age)) return null
  if (age < 18 || age > 120) return null
  return Math.floor(age)
}
