/**
 * Gates serveur Ranked compétitif (CA1) :
 * - 18+ obligatoire ; âge inconnu = refus
 * - grossesse / allaitement = refus compétitif (même garde profil / Photo IA)
 */
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  extractStoredNutritionAge,
  isSafetyBoolTrue,
  NUTRITION_ADULT_MIN,
} from './nutritionProfile'
import { mapNutritionSexToRanked, type RankedSex } from './rankedScience'

export const RANKED_REFUSED_MINOR = 'RANKED_REFUSED_MINOR' as const
export const RANKED_REFUSED_AGE_UNKNOWN = 'RANKED_REFUSED_AGE_UNKNOWN' as const
export const RANKED_REFUSED_PREGNANCY = 'RANKED_REFUSED_PREGNANCY' as const
export const RANKED_REFUSED_BREASTFEEDING = 'RANKED_REFUSED_BREASTFEEDING' as const
export const RANKED_NOT_OPTED_IN = 'RANKED_NOT_OPTED_IN' as const
export const RANKED_FORCE_DISABLED = 'RANKED_FORCE_DISABLED' as const
export const RANKED_DISCIPLINE_DISABLED = 'RANKED_DISCIPLINE_DISABLED' as const

export type RankedGateError =
  | typeof RANKED_REFUSED_MINOR
  | typeof RANKED_REFUSED_AGE_UNKNOWN
  | typeof RANKED_REFUSED_PREGNANCY
  | typeof RANKED_REFUSED_BREASTFEEDING

type DbCtx = MutationCtx | QueryCtx

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export async function loadNutritionProfileJson(
  ctx: DbCtx,
  userId: string,
): Promise<unknown> {
  const nutrition = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  return nutrition?.profileJson
}

/**
 * Fail-closed age gate for Ranked compétitif.
 * Unknown / missing age → refus (stricter than food-add).
 */
export function assertRankedAdultAge(
  profileJson: unknown,
): { ok: true; age: number } | { ok: false; error: RankedGateError } {
  const age = extractStoredNutritionAge(profileJson)
  if (age == null) {
    return { ok: false, error: RANKED_REFUSED_AGE_UNKNOWN }
  }
  if (age < NUTRITION_ADULT_MIN) {
    return { ok: false, error: RANKED_REFUSED_MINOR }
  }
  return { ok: true, age }
}

export function assertRankedNotPregnantOrBreastfeeding(
  profileJson: unknown,
): { ok: true } | { ok: false; error: RankedGateError } {
  if (isSafetyBoolTrue(profileJson, 'declaredPregnancy')) {
    return { ok: false, error: RANKED_REFUSED_PREGNANCY }
  }
  if (isSafetyBoolTrue(profileJson, 'declaredBreastfeeding')) {
    return { ok: false, error: RANKED_REFUSED_BREASTFEEDING }
  }
  return { ok: true }
}

export async function assertRankedCompetitiveAccess(
  ctx: DbCtx,
  userId: string,
): Promise<
  | { ok: true; age: number; sex: RankedSex; profileJson: unknown }
  | { ok: false; error: RankedGateError }
> {
  const profileJson = await loadNutritionProfileJson(ctx, userId)
  const ageGate = assertRankedAdultAge(profileJson)
  if (!ageGate.ok) return ageGate
  const healthGate = assertRankedNotPregnantOrBreastfeeding(profileJson)
  if (!healthGate.ok) return healthGate
  const sex = mapNutritionSexToRanked(asRecord(profileJson)?.sex)
  return { ok: true, age: ageGate.age, sex, profileJson }
}
