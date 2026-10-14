/**
 * Garde serveur « Ajouter un aliment » — lit le profil synchronisé
 * (nutrition_state.profileJson). Jamais de confiance au client.
 *
 * Refuse : mineur (<18), TCA déclaré.
 * Autorise : diabète (ils perdent seulement l’objectif kcal / perte côté client).
 */
import type { MutationCtx, QueryCtx } from '../_generated/server'

export const FOOD_ADD_ACCESS_DENIED = 'FOOD_ADD_ACCESS_DENIED' as const
export const FOOD_ADD_ACCESS_DENIED_MINOR = 'FOOD_ADD_ACCESS_DENIED_MINOR' as const
export const FOOD_ADD_ACCESS_DENIED_TCA = 'FOOD_ADD_ACCESS_DENIED_TCA' as const

const ADULT_MIN = 18

type DbCtx = MutationCtx | QueryCtx

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

export function extractAgeFromProfileJson(profileJson: unknown): unknown {
  return asRecord(profileJson)?.age
}

export function extractEatingDisorderFromProfileJson(profileJson: unknown): boolean {
  const record = asRecord(profileJson)
  if (!record) return false
  if (record.healthAnswer === 'none' || record.healthAnswer === 'prefer_not') return false
  return Boolean(record.declaredEatingDisorder)
}

export function extractDiabetesFromProfileJson(profileJson: unknown): boolean {
  const record = asRecord(profileJson)
  if (!record) return false
  return Boolean(record.declaredDiabetes)
}

export function isAdultStoredAge(age: unknown): age is number {
  return typeof age === 'number' && Number.isFinite(age) && age >= ADULT_MIN && age <= 120
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
  const age = extractAgeFromProfileJson(profileJson)
  if (!isAdultStoredAge(age)) {
    return { ok: false, error: FOOD_ADD_ACCESS_DENIED_MINOR }
  }
  if (extractEatingDisorderFromProfileJson(profileJson)) {
    return { ok: false, error: FOOD_ADD_ACCESS_DENIED_TCA }
  }
  return { ok: true, diabetes: extractDiabetesFromProfileJson(profileJson) }
}
