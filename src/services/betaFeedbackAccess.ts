import { getCalorieProfile } from './nutritionStorage'
import { isMinorAge, isValidAge } from './nutritionSafetyRules'

/**
 * Statut d’âge pour « Donner mon avis ».
 * Même source que le serveur (profil nutrition) — pas d’autre contrôle d’âge.
 * - adult : formulaire
 * - missing : « Complète ton profil… »
 * - minor : réservé aux majeurs
 */
export type BetaFeedbackAgeStatus = 'adult' | 'missing' | 'minor'

export function getBetaFeedbackAgeStatus(age?: unknown): BetaFeedbackAgeStatus {
  const resolved = age !== undefined ? age : getCalorieProfile().age
  if (!isValidAge(resolved)) return 'missing'
  if (isMinorAge(resolved)) return 'minor'
  return 'adult'
}

/** Formulaire utilisable uniquement si adulte (âge connu ≥ 18). */
export function canAccessBetaFeedback(age?: unknown): boolean {
  return getBetaFeedbackAgeStatus(age) === 'adult'
}

/**
 * Entrée menu / route : visible si adulte ou âge manquant.
 * Les mineurs connus restent exclus.
 */
export function canOpenBetaFeedback(age?: unknown): boolean {
  return getBetaFeedbackAgeStatus(age) !== 'minor'
}
