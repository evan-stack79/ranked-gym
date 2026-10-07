import { getCalorieProfile } from './nutritionStorage'
import { isMinorOrUnknownAge } from './nutritionSafetyRules'

/**
 * Garde 18+ UI : entrée masquée si âge mineur ou inconnu (profil nutrition local).
 * Le serveur vérifie indépendamment via `nutrition_state.profileJson.age` (AV-01).
 */
export function canAccessBetaFeedback(age?: unknown): boolean {
  const resolved = age !== undefined ? age : getCalorieProfile().age
  return !isMinorOrUnknownAge(resolved)
}
