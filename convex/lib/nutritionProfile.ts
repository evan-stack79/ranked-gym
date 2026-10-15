/**
 * Unique point d’écriture de `nutrition_state.profileJson`.
 *
 * B15 — SAFETY FIELDS : sync/import ne peuvent jamais les effacer ni passer true→false.
 * Âge mineur : hausse limitée (temps écoulé depuis ageRecordedAt + 1 an de marge).
 * Refus food-add : toujours depuis l’âge / flags STOCKÉS.
 */
import type { MutationCtx } from '../_generated/server'

export const NUTRITION_AGE_MIN = 10
export const NUTRITION_AGE_MAX = 120
export const NUTRITION_ADULT_MIN = 18
export const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/** Champs protégés — clés réelles dans profileJson. */
export const NUTRITION_PROFILE_SAFETY_FIELDS = [
  'age',
  'declaredEatingDisorder',
  'declaredDiabetes',
  'declaredPregnancy',
  'declaredBreastfeeding',
] as const

export type NutritionSafetyBoolField =
  | 'declaredEatingDisorder'
  | 'declaredDiabetes'
  | 'declaredPregnancy'
  | 'declaredBreastfeeding'

export const NUTRITION_SAFETY_BOOL_FIELDS: NutritionSafetyBoolField[] = [
  'declaredEatingDisorder',
  'declaredDiabetes',
  'declaredPregnancy',
  'declaredBreastfeeding',
]

/** Compteur d’écriture — FakeDb refuse tout profileJson hors de writeNutritionProfileJson. */
let nutritionProfileWriteDepth = 0

export function isNutritionProfileWriteAuthorized(): boolean {
  return nutritionProfileWriteDepth > 0
}

export const NUTRITION_AGE_MAJORITY_AUDIT_TABLE = 'nutrition_age_majority_audit' as const
export const NUTRITION_SAFETY_CLEAR_AUDIT_TABLE = 'nutrition_safety_clear_audit' as const

export const AGE_CONTACT_US_MESSAGE = 'Contacte-nous pour corriger ton âge.' as const
export const DIABETES_CLEAR_CONFIRM =
  'Tu retires le diabète. Les objectifs de calories et de perte de poids pourront revenir. Tu confirmes ?' as const
export const PREGNANCY_CLEAR_CONFIRM =
  'Tu retires la grossesse. Les objectifs de calories et de perte de poids pourront revenir. Tu confirmes ?' as const
export const BREASTFEEDING_CLEAR_CONFIRM =
  'Tu retires l’allaitement. Les objectifs de calories et de perte de poids pourront revenir. Tu confirmes ?' as const
export const SAFETY_CLEAR_SIGN_IN = 'Connecte-toi pour retirer cette situation.' as const
export const TCA_LOCKED_MESSAGE = 'Pour retirer cette situation, contacte-nous.' as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Âge valide entrant / stocké : entier ou string d’entier seul, 10–120 inclus.
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

export function extractAgeRecordedAt(profileJson: unknown): number | null {
  const raw = asRecord(profileJson)?.ageRecordedAt
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  return null
}

export function isSafetyBoolTrue(profileJson: unknown, field: NutritionSafetyBoolField): boolean {
  return Boolean(asRecord(profileJson)?.[field])
}

/**
 * Hausse max autorisée pour un mineur : années écoulées depuis ageRecordedAt + 1.
 * Ex. enregistré aujourd’hui → +1 an max (anniversaire).
 */
export function maxMinorAgeIncrease(ageRecordedAt: number | null, now: number): number {
  if (ageRecordedAt == null || ageRecordedAt <= 0 || now < ageRecordedAt) return 1
  return Math.floor((now - ageRecordedAt) / MS_PER_YEAR) + 1
}

export function decideMergedAge(args: {
  prevAge: number | null
  nextAge: number | null
  ageRecordedAt: number | null
  now: number
  /** Conservé à la première écriture (import / seed) si déjà présent. */
  incomingAgeRecordedAt?: number | null
}): {
  age: number | null
  ageRecordedAt: number | null
  ageChanged: boolean
  ageRejectedContactUs: boolean
  becameAdultFromMinor: boolean
} {
  const { prevAge, nextAge, ageRecordedAt, now, incomingAgeRecordedAt } = args

  if (nextAge == null) {
    return {
      age: prevAge,
      ageRecordedAt: prevAge != null ? ageRecordedAt : null,
      ageChanged: false,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  if (prevAge == null) {
    return {
      age: nextAge,
      ageRecordedAt:
        incomingAgeRecordedAt != null && incomingAgeRecordedAt > 0
          ? incomingAgeRecordedAt
          : now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Baisse toujours acceptée.
  if (nextAge < prevAge) {
    return {
      age: nextAge,
      ageRecordedAt: now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  if (nextAge === prevAge) {
    return {
      age: prevAge,
      ageRecordedAt: ageRecordedAt ?? now,
      ageChanged: false,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Hausse.
  if (prevAge >= NUTRITION_ADULT_MIN) {
    // Adulte : libre dans 10–120.
    return {
      age: nextAge,
      ageRecordedAt: now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Mineur : limite temps + 1 an de marge (AV-01).
  const maxUp = maxMinorAgeIncrease(ageRecordedAt, now)
  if (nextAge > prevAge + maxUp) {
    return {
      age: prevAge,
      ageRecordedAt: ageRecordedAt ?? now,
      ageChanged: false,
      ageRejectedContactUs: true,
      becameAdultFromMinor: false,
    }
  }

  return {
    age: nextAge,
    ageRecordedAt: now,
    ageChanged: true,
    ageRejectedContactUs: false,
    becameAdultFromMinor: nextAge >= NUTRITION_ADULT_MIN,
  }
}

/**
 * true stocké ne peut pas passer à false / absent via sync.
 * false → true toujours accepté.
 */
export function mergeSafetyBool(
  stored: boolean,
  incoming: unknown,
): boolean {
  if (stored) return true
  return Boolean(incoming)
}

export type MergeNutritionProfileResult = {
  profileJson: Record<string, unknown>
  becameAdultFromMinor: boolean
  ageRejectedContactUs: boolean
}

/**
 * Fusionne le profil entrant en préservant les SAFETY FIELDS.
 * `incoming` non-objet (null, string, …) → conserve le profil précédent (sécurité).
 */
export function mergeNutritionProfileJson(
  previousProfileJson: unknown,
  incomingProfileJson: unknown,
  now = Date.now(),
): MergeNutritionProfileResult {
  const prevRecord = asRecord(previousProfileJson) ?? {}
  const prevAge = parseValidNutritionAge(prevRecord.age)
  const prevRecordedAt = extractAgeRecordedAt(previousProfileJson)

  if (
    incomingProfileJson == null ||
    typeof incomingProfileJson !== 'object' ||
    Array.isArray(incomingProfileJson)
  ) {
    const kept = { ...prevRecord }
    if (prevAge != null) {
      kept.age = prevAge
      if (prevRecordedAt != null) kept.ageRecordedAt = prevRecordedAt
    }
    for (const field of NUTRITION_SAFETY_BOOL_FIELDS) {
      if (Boolean(prevRecord[field])) kept[field] = true
    }
    return { profileJson: kept, becameAdultFromMinor: false, ageRejectedContactUs: false }
  }

  const incoming = { ...(incomingProfileJson as Record<string, unknown>) }
  const nextAge = parseValidNutritionAge(incoming.age)
  const incomingRecordedAt = extractAgeRecordedAt(incoming)
  const ageDecision = decideMergedAge({
    prevAge,
    nextAge,
    ageRecordedAt: prevRecordedAt,
    now,
    incomingAgeRecordedAt: incomingRecordedAt,
  })

  if (ageDecision.age != null) {
    incoming.age = ageDecision.age
    if (ageDecision.ageRecordedAt != null) incoming.ageRecordedAt = ageDecision.ageRecordedAt
  } else {
    delete incoming.age
    delete incoming.ageRecordedAt
  }

  for (const field of NUTRITION_SAFETY_BOOL_FIELDS) {
    const stored = Boolean(prevRecord[field])
    incoming[field] = mergeSafetyBool(stored, incoming[field])
    if (!incoming[field]) delete incoming[field]
  }

  return {
    profileJson: incoming,
    becameAdultFromMinor: ageDecision.becameAdultFromMinor,
    ageRejectedContactUs: ageDecision.ageRejectedContactUs,
  }
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
): Promise<{
  profileJson: Record<string, unknown>
  wroteMajorityAudit: boolean
  ageRejectedContactUs: boolean
}> {
  nutritionProfileWriteDepth += 1
  try {
    const existing = await ctx.db
      .query('nutrition_state')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    const { profileJson, becameAdultFromMinor, ageRejectedContactUs } = mergeNutritionProfileJson(
      existing?.profileJson,
      args.incomingProfileJson,
      args.updatedAt,
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

    return { profileJson, wroteMajorityAudit: becameAdultFromMinor, ageRejectedContactUs }
  } finally {
    nutritionProfileWriteDepth -= 1
  }
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
 * effacer un SAFETY FIELD déjà true / âge valide.
 */
export async function applyNutritionProfileFromAccountLink(
  ctx: MutationCtx,
  userId: string,
  incomingProfileJson: unknown,
  updatedAt = Date.now(),
) {
  return writeNutritionProfileJson(ctx, { userId, incomingProfileJson, updatedAt })
}

/**
 * Action délibérée : retire un flag booléen de sécurité (jamais via sync).
 * Audit : userId + at uniquement.
 */
export async function clearNutritionSafetyBoolField(
  ctx: MutationCtx,
  args: {
    userId: string
    field: NutritionSafetyBoolField
    updatedAt?: number
  },
): Promise<{ cleared: boolean }> {
  // TCA : pas de retrait via l’app dans ce PR.
  if (args.field === 'declaredEatingDisorder') {
    throw new Error('NUTRITION_SAFETY_TCA_LOCKED')
  }

  const now = args.updatedAt ?? Date.now()
  nutritionProfileWriteDepth += 1
  try {
    const existing = await ctx.db
      .query('nutrition_state')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()
    if (!existing) return { cleared: false }

    const prev = asRecord(existing.profileJson) ?? {}
    if (!Boolean(prev[args.field])) return { cleared: false }

    const next = { ...prev }
    delete next[args.field]

    await ctx.db.patch(existing._id, {
      profileJson: next,
      updatedAt: now,
    })
    await ctx.db.insert(NUTRITION_SAFETY_CLEAR_AUDIT_TABLE, {
      userId: args.userId,
      at: now,
    })
    return { cleared: true }
  } finally {
    nutritionProfileWriteDepth -= 1
  }
}
