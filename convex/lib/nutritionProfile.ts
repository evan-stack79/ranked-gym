/**
 * Unique point d’écriture de `nutrition_state.profileJson`.
 *
 * Règle âge (B14) : un sync / import / update ne peut jamais effacer un âge
 * serveur déjà valide. Âge valide = entier (ou chaîne d’entier seul) ∈ [10, 120].
 * Refus food-add : toujours depuis l’âge STOCKÉ, jamais depuis le payload téléphone.
 */
import type { MutationCtx } from '../_generated/server'

export const NUTRITION_AGE_MIN = 10
export const NUTRITION_AGE_MAX = 120
export const NUTRITION_ADULT_MIN = 18

/** Table d’audit majorité (userId + at uniquement). */
export const NUTRITION_AGE_MAJORITY_AUDIT_TABLE = 'nutrition_age_majority_audit' as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Âge valide entrant / stocké : entier ou string d’entier seul, 10–120 inclus.
 * Ex. 16, "16" → 16 ; 0, 150, -15, 17.9, "16a" → null.
 */
export function parseValidNutritionAge(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null
    if (value < NUTRITION_AGE_MIN || value > NUTRITION_AGE_MAX) return null
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) return null
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < NUTRITION_AGE_MIN || n > NUTRITION_AGE_MAX) return null
    return n
  }
  return null
}

export function extractRawAgeFromProfileJson(profileJson: unknown): unknown {
  return asRecord(profileJson)?.age
}

export function extractStoredNutritionAge(profileJson: unknown): number | null {
  return parseValidNutritionAge(extractRawAgeFromProfileJson(profileJson))
}

export type MergeNutritionProfileResult = {
  profileJson: Record<string, unknown>
  /** true si âge stocké < 18 et nouvel âge valide ≥ 18. */
  becameAdultFromMinor: boolean
}

/**
 * Fusionne le profil entrant avec le précédent en préservant un âge valide stocké.
 * `incoming` non-objet (null, string, …) → conserve le profil précédent entier.
 */
export function mergeNutritionProfileJson(
  previousProfileJson: unknown,
  incomingProfileJson: unknown,
): MergeNutritionProfileResult {
  const prevRecord = asRecord(previousProfileJson) ?? {}
  const prevAge = parseValidNutritionAge(prevRecord.age)

  if (incomingProfileJson == null || typeof incomingProfileJson !== 'object' || Array.isArray(incomingProfileJson)) {
    const kept = { ...prevRecord }
    if (prevAge != null) kept.age = prevAge
    return { profileJson: kept, becameAdultFromMinor: false }
  }

  const incoming = { ...(incomingProfileJson as Record<string, unknown>) }
  const nextAge = parseValidNutritionAge(incoming.age)
  const ageToStore = nextAge ?? prevAge

  if (ageToStore != null) {
    incoming.age = ageToStore
  } else {
    delete incoming.age
  }

  const becameAdultFromMinor =
    prevAge != null && prevAge < NUTRITION_ADULT_MIN && nextAge != null && nextAge >= NUTRITION_ADULT_MIN

  return { profileJson: incoming, becameAdultFromMinor }
}

/**
 * SEUL endroit autorisé à écrire `profileJson` via db.insert / db.patch / db.replace.
 */
export async function writeNutritionProfileJson(
  ctx: MutationCtx,
  args: {
    userId: string
    incomingProfileJson: unknown
    updatedAt: number
    journalJson?: unknown
  },
): Promise<{ profileJson: Record<string, unknown>; wroteMajorityAudit: boolean }> {
  const existing = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .first()

  const { profileJson, becameAdultFromMinor } = mergeNutritionProfileJson(
    existing?.profileJson,
    args.incomingProfileJson,
  )

  if (becameAdultFromMinor) {
    await ctx.db.insert(NUTRITION_AGE_MAJORITY_AUDIT_TABLE, {
      userId: args.userId,
      at: args.updatedAt,
    })
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      profileJson,
      ...(args.journalJson !== undefined ? { journalJson: args.journalJson } : {}),
      updatedAt: args.updatedAt,
    })
  } else {
    await ctx.db.insert('nutrition_state', {
      userId: args.userId,
      profileJson,
      journalJson: args.journalJson ?? {},
      updatedAt: args.updatedAt,
    })
  }

  return { profileJson, wroteMajorityAudit: becameAdultFromMinor }
}

/** Chemin « mise à jour profil » — passe toujours par writeNutritionProfileJson. */
export async function updateNutritionProfileForUser(
  ctx: MutationCtx,
  userId: string,
  incomingProfileJson: unknown,
  updatedAt = Date.now(),
) {
  return writeNutritionProfileJson(ctx, { userId, incomingProfileJson, updatedAt })
}

/**
 * Chemin « liaison de compte / legacy » — applique un profil importé sans pouvoir
 * effacer un âge serveur déjà valide.
 */
export async function applyNutritionProfileFromAccountLink(
  ctx: MutationCtx,
  userId: string,
  incomingProfileJson: unknown,
  updatedAt = Date.now(),
) {
  return writeNutritionProfileJson(ctx, { userId, incomingProfileJson, updatedAt })
}
