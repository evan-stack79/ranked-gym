/**
 * Accès à l’écran / mutation « Ajouter un aliment » et journal repas.
 *
 * - Âge manquant → `age_required` (prompt bloquant côté client ; erreur serveur claire).
 * - Mineur (<18) / TCA → ajout & édition refusés ; suppression toujours OK.
 * - Diabète → accès autorisé (perd seulement l’objectif kcal / perte).
 */
import type { CalorieProfile } from '../types/nutrition'
import {
  isMinorAge,
  isValidAge,
  readHealthDeclarations,
  type SafetyProfileInput,
} from './nutritionSafetyRules'

export const FOOD_ADD_ACCESS_DENIED = 'FOOD_ADD_ACCESS_DENIED' as const
export const FOOD_ADD_ACCESS_AGE_REQUIRED = 'age_required' as const

export type FoodAddAccessReason = 'allowed' | 'minor' | 'eating_disorder' | 'age_required'

export type FoodAddProfile = SafetyProfileInput | Pick<
  CalorieProfile,
  'age' | 'declaredEatingDisorder' | 'healthAnswer' | 'declaredDiabetes'
> | null | undefined

export function decideFoodAddAccess(
  profile: FoodAddProfile,
): { allowed: boolean; reason: FoodAddAccessReason } {
  if (!profile) {
    return { allowed: false, reason: 'age_required' }
  }
  if (!isValidAge(profile.age)) {
    return { allowed: false, reason: 'age_required' }
  }
  if (isMinorAge(profile.age)) {
    return { allowed: false, reason: 'minor' }
  }
  const declarations = readHealthDeclarations(profile)
  if (declarations.eatingDisorder) {
    return { allowed: false, reason: 'eating_disorder' }
  }
  return { allowed: true, reason: 'allowed' }
}

export function canAccessFoodAdd(profile: FoodAddProfile): boolean {
  return decideFoodAddAccess(profile).allowed
}

/** Âge manquant → afficher le prompt bloquant (ne pas traiter comme mineur). */
export function needsAgePrompt(profile: FoodAddProfile): boolean {
  return decideFoodAddAccess(profile).reason === 'age_required'
}

/**
 * Journal repas visible seulement si âge adulte connu et pas de TCA.
 * Les repas locaux ne sont jamais effacés quand le journal est masqué.
 */
export function canShowMealJournal(profile: FoodAddProfile): boolean {
  return decideFoodAddAccess(profile).allowed
}
