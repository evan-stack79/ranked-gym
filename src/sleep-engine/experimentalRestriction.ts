/**
 * EXPERIMENTAL — désactivé par défaut.
 *
 * Ne PAS utiliser comme thérapie de restriction du temps au lit (CBT-I).
 * Une application grand public ne doit pas réduire automatiquement le TIB
 * d’un utilisateur comme un traitement de l’insomnie.
 *
 * Ce module est volontairement isolé du moteur principal `runSleepEngine`.
 * Aucune valeur TIB_ABSOLUTE_MINIMUM n’est appliquée en production V1.
 */

export const SLEEP_RESTRICTION_EXPERIMENTAL_ENABLED = false

export interface ExperimentalTibSuggestionInput {
  currentTibHours: number
  sleepEfficiencyPercent: number
}

export interface ExperimentalTibSuggestionResult {
  enabled: false
  message: string
}

/**
 * Stub non opérationnel — retourne toujours `enabled: false`.
 */
export function experimentalSuggestTibRestriction(
  _input: ExperimentalTibSuggestionInput,
): ExperimentalTibSuggestionResult {
  return {
    enabled: false,
    message:
      'La suggestion automatique de restriction du temps au lit est désactivée. ' +
      'Elle n’est pas un traitement médical et n’est pas intégrée au Sleep Engine V1.',
  }
}
