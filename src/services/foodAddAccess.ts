/**
 * Accès à l’écran / mutation « Ajouter un aliment » (v3).
 *
 * Caché pour mineurs (<18) et TCA déclaré — client ET serveur.
 * Les comptes diabétiques VOIENT l’écran (ils perdent seulement
 * l’objectif calorique automatique et l’objectif de perte de poids).
 */
import type { CalorieProfile } from '../types/nutrition'
import {
  isMinorOrUnknownAge,
  readHealthDeclarations,
  type SafetyProfileInput,
} from './nutritionSafetyRules'

export const FOOD_ADD_ACCESS_DENIED = 'FOOD_ADD_ACCESS_DENIED' as const

export type FoodAddAccessReason = 'allowed' | 'minor' | 'eating_disorder'

export function decideFoodAddAccess(
  profile: SafetyProfileInput | Pick<CalorieProfile, 'age' | 'declaredEatingDisorder' | 'healthAnswer' | 'declaredDiabetes'> | null | undefined,
): { allowed: boolean; reason: FoodAddAccessReason } {
  if (!profile) {
    return { allowed: false, reason: 'minor' }
  }
  // Âge inconnu = protégé (aligné serveur fail-closed).
  if (isMinorOrUnknownAge(profile.age)) {
    return { allowed: false, reason: 'minor' }
  }
  const declarations = readHealthDeclarations(profile)
  if (declarations.eatingDisorder) {
    return { allowed: false, reason: 'eating_disorder' }
  }
  // Diabète : accès autorisé (pas de refus ici).
  return { allowed: true, reason: 'allowed' }
}

export function canAccessFoodAdd(
  profile: SafetyProfileInput | Pick<CalorieProfile, 'age' | 'declaredEatingDisorder' | 'healthAnswer' | 'declaredDiabetes'> | null | undefined,
): boolean {
  return decideFoodAddAccess(profile).allowed
}
