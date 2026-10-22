/**
 * Accès à l’écran / mutation « Ajouter un aliment » et journal repas.
 *
 * - Âge manquant → accès legacy autorisé (ne bloque pas ce qui marchait déjà).
 *   Pour V3 uniquement : `needsAgePrompt` → demander l’âge avant d’ouvrir l’écran.
 * - Mineur (<18, âge connu) / TCA → ajout & édition refusés ; suppression toujours OK.
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
    // Pas de profil stocké ≠ mineur : legacy reste utilisable.
    return { allowed: true, reason: 'allowed' }
  }
  if (isValidAge(profile.age) && isMinorAge(profile.age)) {
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

/**
 * V3 only — aligné serveur B16 : `declaredEatingDisorder` true refuse
 * même si healthAnswer local est none / prefer_not.
 * Ne pas utiliser quand VITE_ENABLE_FOOD_ADD_V3 est OFF (legacy inchangé).
 */
export function hasDeclaredEatingDisorderFlag(profile: FoodAddProfile): boolean {
  if (!profile) return false
  if ('declarations' in profile && profile.declarations) {
    return Boolean(profile.declarations.eatingDisorder)
  }
  if ('declaredEatingDisorder' in profile) {
    return Boolean(profile.declaredEatingDisorder)
  }
  return false
}

export function decideFoodAddAccessV3(
  profile: FoodAddProfile,
): { allowed: boolean; reason: FoodAddAccessReason } {
  if (!profile) {
    return { allowed: true, reason: 'allowed' }
  }
  if (isValidAge(profile.age) && isMinorAge(profile.age)) {
    return { allowed: false, reason: 'minor' }
  }
  if (hasDeclaredEatingDisorderFlag(profile)) {
    return { allowed: false, reason: 'eating_disorder' }
  }
  const declarations = readHealthDeclarations(profile)
  if (declarations.eatingDisorder) {
    return { allowed: false, reason: 'eating_disorder' }
  }
  return { allowed: true, reason: 'allowed' }
}

export function canAccessFoodAddV3(profile: FoodAddProfile): boolean {
  return decideFoodAddAccessV3(profile).allowed
}

/**
 * Âge manquant → prompt V3 « Ajouter un aliment » uniquement
 * (derrière `VITE_ENABLE_FOOD_ADD_V3`). Ne pas utiliser pour bloquer le legacy.
 */
export function needsAgePrompt(profile: FoodAddProfile): boolean {
  if (!profile) return true
  return !isValidAge(profile.age)
}

/**
 * Journal repas : masqué pour mineur (âge connu) et TCA.
 * Âge manquant → visible (ne bloque pas le legacy).
 * Les repas locaux ne sont jamais effacés quand le journal est masqué.
 */
export function canShowMealJournal(profile: FoodAddProfile): boolean {
  return decideFoodAddAccess(profile).allowed
}
