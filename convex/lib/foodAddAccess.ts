/**
 * Garde serveur « Ajouter un aliment » / écritures repas — lit le profil synchronisé
 * (nutrition_state.profileJson). Jamais de confiance au client.
 *
 * Refuse add/edit : mineur (<18) quand un âge est enregistré, TCA déclaré.
 * Âge manquant : ACCEPTÉ (ne bloque pas ce qui marchait déjà) — le client V3
 * demande l’âge avant d’ouvrir « Ajouter un aliment » v3.
 * Autorise : diabète (ils perdent seulement l’objectif kcal / perte côté client).
 * La suppression de repas n’utilise PAS cette garde (droit sur ses données).
 */
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  extractStoredNutritionAge,
  NUTRITION_ADULT_MIN,
  parseValidNutritionAge,
} from './nutritionProfile'

export const FOOD_ADD_ACCESS_DENIED = 'FOOD_ADD_ACCESS_DENIED' as const
export const FOOD_ADD_ACCESS_DENIED_MINOR = 'FOOD_ADD_ACCESS_DENIED_MINOR' as const
export const FOOD_ADD_ACCESS_DENIED_TCA = 'FOOD_ADD_ACCESS_DENIED_TCA' as const
/**
 * Conservé pour compat messages client ; le serveur n’émet plus ce refus
 * (âge manquant = accès autorisé).
 */
export const FOOD_ADD_ACCESS_AGE_REQUIRED = 'age_required' as const

type DbCtx = MutationCtx | QueryCtx

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

export function extractAgeFromProfileJson(profileJson: unknown): unknown {
  return asRecord(profileJson)?.age
}

/** B16-01 — TCA true refuse toujours, quel que soit healthAnswer. */
export function extractEatingDisorderFromProfileJson(profileJson: unknown): boolean {
  const record = asRecord(profileJson)
  if (!record) return false
  return Boolean(record.declaredEatingDisorder)
}

export function extractDiabetesFromProfileJson(profileJson: unknown): boolean {
  const record = asRecord(profileJson)
  if (!record) return false
  return Boolean(record.declaredDiabetes)
}

/** Âge stocké valide (10–120), y compris string d’entier seul héritée. */
export function hasStoredAge(age: unknown): age is number {
  return parseValidNutritionAge(age) != null
}

export function isAdultStoredAge(age: unknown): age is number {
  const parsed = parseValidNutritionAge(age)
  return parsed != null && parsed >= NUTRITION_ADULT_MIN
}

export type FoodAddAccessResult =
  | { ok: true; diabetes: boolean }
  | {
      ok: false
      error: typeof FOOD_ADD_ACCESS_DENIED_MINOR | typeof FOOD_ADD_ACCESS_DENIED_TCA
    }

export async function assertFoodAddAccessFromStoredProfile(
  ctx: DbCtx,
  userId: string,
): Promise<FoodAddAccessResult> {
  const nutrition = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const profileJson = nutrition?.profileJson
  // Refus toujours depuis l’âge STOCKÉ (jamais le payload téléphone).
  const age = extractStoredNutritionAge(profileJson)
  // Âge manquant : ne pas refuser (comportement pré-PR #110).
  // Âge enregistré sous 18 : refuser.
  if (age != null && age < NUTRITION_ADULT_MIN) {
    return { ok: false, error: FOOD_ADD_ACCESS_DENIED_MINOR }
  }
  if (extractEatingDisorderFromProfileJson(profileJson)) {
    return { ok: false, error: FOOD_ADD_ACCESS_DENIED_TCA }
  }
  return { ok: true, diabetes: extractDiabetesFromProfileJson(profileJson) }
}
