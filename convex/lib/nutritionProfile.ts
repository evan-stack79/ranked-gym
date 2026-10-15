/**
 * Unique point d’écriture de `nutrition_state.profileJson`.
 *
 * B15/B16 — SAFETY FIELDS : sync/import ne peuvent jamais les effacer ni passer true→false.
 * healthAnswer : calculé serveur (jamais confiance client).
 * Âge mineur : limite via minorAgeRef { age, at } (première référence <18).
 * Client ageRecordedAt : toujours ignoré.
 * clear / admin : passent uniquement par writeNutritionProfileJson.
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
  'minorAgeRef',
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
export const NUTRITION_SAFETY_ADMIN_AUDIT_TABLE = 'nutrition_safety_admin_audit' as const

export const AGE_CONTACT_US_MESSAGE = 'Pour corriger ton âge, écris-nous.' as const
export const DIABETES_CLEAR_CONFIRM =
  'Tu retires le diabète de ta liste ? Les objectifs de calories et de perte de poids pourront revenir. Si tu as un diabète, garde la case cochée.' as const
export const PREGNANCY_CLEAR_CONFIRM =
  'Tu retires la grossesse ? Les objectifs de calories pourront revenir. Demande à ta sage-femme ou à ton médecin avant de viser une perte de poids.' as const
export const BREASTFEEDING_CLEAR_CONFIRM =
  'Tu retires l’allaitement ? Les objectifs de calories pourront revenir. Demande à ta sage-femme ou à ton médecin avant de viser une perte de poids.' as const
export const SAFETY_CLEAR_SIGN_IN = 'Connecte-toi pour retirer cette situation.' as const
export const TCA_LOCKED_MESSAGE =
  'Cette situation reste enregistrée pour te protéger. Pour la retirer, écris-nous.' as const

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export type MinorAgeRef = { age: number; at: number }

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

export function extractMinorAgeRef(profileJson: unknown): MinorAgeRef | null {
  const raw = asRecord(profileJson)?.minorAgeRef
  const rec = asRecord(raw)
  if (!rec) return null
  const age = parseValidNutritionAge(rec.age)
  const at = typeof rec.at === 'number' && Number.isFinite(rec.at) && rec.at > 0 ? rec.at : null
  if (age == null || at == null || age >= NUTRITION_ADULT_MIN) return null
  return { age, at }
}

export function isSafetyBoolTrue(profileJson: unknown, field: NutritionSafetyBoolField): boolean {
  return Boolean(asRecord(profileJson)?.[field])
}

export function anySafetyBoolTrue(profileJson: unknown): boolean {
  const rec = asRecord(profileJson) ?? {}
  return NUTRITION_SAFETY_BOOL_FIELDS.some((f) => Boolean(rec[f]))
}

/**
 * healthAnswer serveur.
 * Si un flag booléen de sécurité est true → toujours 'situations' (client ignoré).
 * Sinon → null (le merge peut alors garder none / prefer_not client).
 */
export function computeServerHealthAnswer(
  flags: Record<string, unknown>,
): 'situations' | null {
  for (const field of NUTRITION_SAFETY_BOOL_FIELDS) {
    if (Boolean(flags[field])) return 'situations'
  }
  return null
}

function applyServerHealthAnswer(
  target: Record<string, unknown>,
  clientHealthAnswer?: unknown,
): void {
  const forced = computeServerHealthAnswer(target)
  if (forced) {
    target.healthAnswer = forced
    return
  }
  // Aucun flag true : autoriser none / prefer_not / situations client ; sinon retirer.
  if (
    clientHealthAnswer === 'none' ||
    clientHealthAnswer === 'prefer_not' ||
    clientHealthAnswer === 'situations'
  ) {
    target.healthAnswer = clientHealthAnswer
  } else {
    delete target.healthAnswer
  }
}

/**
 * Âge max autorisé pour un mineur : refAge + années écoulées depuis ref.at + 1.
 * Sans ref : +1 an de marge depuis « maintenant » (strict).
 */
export function maxAllowedAgeFromMinorRef(ref: MinorAgeRef | null, now: number): number | null {
  if (ref == null) return null
  const elapsedYears =
    ref.at <= 0 || now < ref.at ? 0 : Math.floor((now - ref.at) / MS_PER_YEAR)
  return ref.age + elapsedYears + 1
}

/** @deprecated Prefer maxAllowedAgeFromMinorRef — conservé pour tests B15. */
export function maxMinorAgeIncrease(ageRecordedAt: number | null, now: number): number {
  if (ageRecordedAt == null || ageRecordedAt <= 0 || now < ageRecordedAt) return 1
  return Math.floor((now - ageRecordedAt) / MS_PER_YEAR) + 1
}

/**
 * Décide âge + minorAgeRef.
 * - Client ageRecordedAt toujours ignoré.
 * - minorAgeRef : première référence <18, jamais changée par sync (sauf admin).
 * - Baisse d’âge acceptée sans reset de la ref.
 */
export function decideMergedAge(args: {
  prevAge: number | null
  nextAge: number | null
  prevMinorAgeRef: MinorAgeRef | null
  /** Legacy server ageRecordedAt — seed minorAgeRef if ref absent. */
  prevAgeRecordedAt: number | null
  now: number
  /** Admin : ignore la limite mineur. */
  bypassMinorLimit?: boolean
}): {
  age: number | null
  minorAgeRef: MinorAgeRef | null
  ageRecordedAt: number | null
  ageChanged: boolean
  ageRejectedContactUs: boolean
  becameAdultFromMinor: boolean
} {
  const { prevAge, nextAge, prevMinorAgeRef, prevAgeRecordedAt, now, bypassMinorLimit } = args

  // Seed / conserve la ref mineur.
  let minorAgeRef = prevMinorAgeRef
  if (minorAgeRef == null && prevAge != null && prevAge < NUTRITION_ADULT_MIN) {
    // Ancienne ligne : date = ageRecordedAt serveur s’il existe, sinon now (strictest B16-03).
    minorAgeRef = { age: prevAge, at: prevAgeRecordedAt ?? now }
  }

  if (nextAge == null) {
    return {
      age: prevAge,
      minorAgeRef,
      ageRecordedAt: prevAge != null ? prevAgeRecordedAt : null,
      ageChanged: false,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  if (prevAge == null) {
    const ref =
      nextAge < NUTRITION_ADULT_MIN
        ? ({ age: nextAge, at: now } satisfies MinorAgeRef)
        : minorAgeRef
    return {
      age: nextAge,
      minorAgeRef: ref,
      ageRecordedAt: now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Baisse toujours acceptée — ne reset PAS la ref.
  if (nextAge < prevAge) {
    return {
      age: nextAge,
      minorAgeRef,
      ageRecordedAt: now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  if (nextAge === prevAge) {
    return {
      age: prevAge,
      minorAgeRef,
      ageRecordedAt: prevAgeRecordedAt ?? now,
      ageChanged: false,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Hausse.
  if (prevAge >= NUTRITION_ADULT_MIN && (minorAgeRef == null || bypassMinorLimit)) {
    return {
      age: nextAge,
      minorAgeRef,
      ageRecordedAt: now,
      ageChanged: true,
      ageRejectedContactUs: false,
      becameAdultFromMinor: false,
    }
  }

  // Limite mineur via minorAgeRef (pas via ageRecordedAt resettable).
  if (!bypassMinorLimit) {
    // Ensure ref exists for current minor.
    if (minorAgeRef == null && prevAge < NUTRITION_ADULT_MIN) {
      minorAgeRef = { age: prevAge, at: now }
    }
    const maxAllowed = maxAllowedAgeFromMinorRef(minorAgeRef, now)
    if (maxAllowed != null && nextAge > maxAllowed) {
      return {
        age: prevAge,
        minorAgeRef,
        ageRecordedAt: prevAgeRecordedAt ?? now,
        ageChanged: false,
        ageRejectedContactUs: true,
        becameAdultFromMinor: false,
      }
    }
  }

  return {
    age: nextAge,
    minorAgeRef,
    ageRecordedAt: now,
    ageChanged: true,
    ageRejectedContactUs: false,
    becameAdultFromMinor: prevAge < NUTRITION_ADULT_MIN && nextAge >= NUTRITION_ADULT_MIN,
  }
}

/**
 * true stocké ne peut pas passer à false / absent via sync.
 * false → true toujours accepté.
 */
export function mergeSafetyBool(stored: boolean, incoming: unknown): boolean {
  if (stored) return true
  return Boolean(incoming)
}

export type MergeNutritionProfileResult = {
  profileJson: Record<string, unknown>
  becameAdultFromMinor: boolean
  ageRejectedContactUs: boolean
}

export type WriteNutritionDeliberate =
  | { kind: 'clearSafetyBool'; field: NutritionSafetyBoolField }
  | {
      kind: 'adminCorrect'
      field: AdminCorrectableField
      value: boolean | number | null
    }

/**
 * Fusionne le profil entrant en préservant les SAFETY FIELDS.
 * `incoming` non-objet (null, string, …) → conserve le profil précédent (sécurité).
 * healthAnswer client ignoré ; forcé à 'situations' si un flag booléen est true.
 * Client ageRecordedAt toujours ignoré.
 */
export function mergeNutritionProfileJson(
  previousProfileJson: unknown,
  incomingProfileJson: unknown,
  now = Date.now(),
  deliberate?: WriteNutritionDeliberate,
): MergeNutritionProfileResult {
  const prevRecord = asRecord(previousProfileJson) ?? {}
  const prevAge = parseValidNutritionAge(prevRecord.age)
  const prevRecordedAt = extractAgeRecordedAt(previousProfileJson)
  const prevMinorRef = extractMinorAgeRef(previousProfileJson)

  // --- Chemins délibérés (clear / admin) : partent du profil stocké. ---
  if (deliberate?.kind === 'clearSafetyBool') {
    if (deliberate.field === 'declaredEatingDisorder') {
      throw new Error('NUTRITION_SAFETY_TCA_LOCKED')
    }
    const next = { ...prevRecord }
    if (!Boolean(next[deliberate.field])) {
      return { profileJson: next, becameAdultFromMinor: false, ageRejectedContactUs: false }
    }
    delete next[deliberate.field]
    applyServerHealthAnswer(next)
    return { profileJson: next, becameAdultFromMinor: false, ageRejectedContactUs: false }
  }

  if (deliberate?.kind === 'adminCorrect') {
    const next = { ...prevRecord }
    if (deliberate.field === 'age') {
      if (deliberate.value == null) {
        delete next.age
        delete next.ageRecordedAt
        delete next.minorAgeRef
      } else {
        const age = parseValidNutritionAge(deliberate.value)
        if (age == null) {
          return {
            profileJson: prevRecord,
            becameAdultFromMinor: false,
            ageRejectedContactUs: false,
          }
        }
        const wasMinor = prevAge != null && prevAge < NUTRITION_ADULT_MIN
        next.age = age
        next.ageRecordedAt = now
        if (age < NUTRITION_ADULT_MIN) {
          next.minorAgeRef = { age, at: now }
        } else {
          // Admin peut lever la ref en passant à 18+.
          delete next.minorAgeRef
        }
        applyServerHealthAnswer(next)
        return {
          profileJson: next,
          becameAdultFromMinor: Boolean(wasMinor && age >= NUTRITION_ADULT_MIN),
          ageRejectedContactUs: false,
        }
      }
    } else if (typeof deliberate.value === 'boolean') {
      if (deliberate.value) next[deliberate.field] = true
      else delete next[deliberate.field]
    } else {
      return {
        profileJson: prevRecord,
        becameAdultFromMinor: false,
        ageRejectedContactUs: false,
      }
    }
    applyServerHealthAnswer(next)
    // Preserve minorAgeRef unless age was admin-cleared above.
    if (prevMinorRef && deliberate.field !== 'age') {
      next.minorAgeRef = prevMinorRef
    }
    return { profileJson: next, becameAdultFromMinor: false, ageRejectedContactUs: false }
  }

  // --- Sync / import / update normal ---
  if (
    incomingProfileJson == null ||
    typeof incomingProfileJson !== 'object' ||
    Array.isArray(incomingProfileJson)
  ) {
    const kept = { ...prevRecord }
    // Ignore any client ageRecordedAt; preserve server dates / ref.
    if (prevAge != null) {
      kept.age = prevAge
      if (prevRecordedAt != null) kept.ageRecordedAt = prevRecordedAt
    }
    for (const field of NUTRITION_SAFETY_BOOL_FIELDS) {
      if (Boolean(prevRecord[field])) kept[field] = true
      else delete kept[field]
    }
    // Seed minorAgeRef if missing on old minor row.
    let ref = prevMinorRef
    if (ref == null && prevAge != null && prevAge < NUTRITION_ADULT_MIN) {
      ref = { age: prevAge, at: prevRecordedAt ?? now }
    }
    if (ref) kept.minorAgeRef = ref
    else delete kept.minorAgeRef
    applyServerHealthAnswer(kept, prevRecord.healthAnswer)
    return { profileJson: kept, becameAdultFromMinor: false, ageRejectedContactUs: false }
  }

  const incoming = { ...(incomingProfileJson as Record<string, unknown>) }
  const clientHealthAnswer = incoming.healthAnswer
  // B16-03 — toujours ignorer ageRecordedAt / minorAgeRef client.
  delete incoming.ageRecordedAt
  delete incoming.minorAgeRef

  const nextAge = parseValidNutritionAge(incoming.age)
  const ageDecision = decideMergedAge({
    prevAge,
    nextAge,
    prevMinorAgeRef: prevMinorRef,
    prevAgeRecordedAt: prevRecordedAt,
    now,
  })

  if (ageDecision.age != null) {
    incoming.age = ageDecision.age
    if (ageDecision.ageRecordedAt != null) incoming.ageRecordedAt = ageDecision.ageRecordedAt
  } else {
    delete incoming.age
    delete incoming.ageRecordedAt
  }

  if (ageDecision.minorAgeRef) incoming.minorAgeRef = ageDecision.minorAgeRef
  else delete incoming.minorAgeRef

  for (const field of NUTRITION_SAFETY_BOOL_FIELDS) {
    const stored = Boolean(prevRecord[field])
    incoming[field] = mergeSafetyBool(stored, incoming[field])
    if (!incoming[field]) delete incoming[field]
  }

  // healthAnswer : forcé 'situations' si flag true ; sinon none/prefer_not client OK.
  applyServerHealthAnswer(incoming, clientHealthAnswer)

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
    deliberate?: WriteNutritionDeliberate
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
      args.deliberate,
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
 * Passe uniquement par writeNutritionProfileJson. Audit : userId + at uniquement.
 */
export async function clearNutritionSafetyBoolField(
  ctx: MutationCtx,
  args: {
    userId: string
    field: NutritionSafetyBoolField
    updatedAt?: number
  },
): Promise<{ cleared: boolean }> {
  if (args.field === 'declaredEatingDisorder') {
    throw new Error('NUTRITION_SAFETY_TCA_LOCKED')
  }

  const now = args.updatedAt ?? Date.now()
  const existing = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .first()
  if (!existing) return { cleared: false }

  const prev = asRecord(existing.profileJson) ?? {}
  if (!Boolean(prev[args.field])) return { cleared: false }

  await writeNutritionProfileJson(ctx, {
    userId: args.userId,
    incomingProfileJson: {},
    updatedAt: now,
    deliberate: { kind: 'clearSafetyBool', field: args.field },
  })
  await ctx.db.insert(NUTRITION_SAFETY_CLEAR_AUDIT_TABLE, {
    userId: args.userId,
    at: now,
  })
  return { cleared: true }
}

export type AdminCorrectableField = NutritionSafetyBoolField | 'age'

/**
 * Correction équipe (dashboard Convex uniquement — internalMutation).
 * Avant de corriger quoi que ce soit, vérifier que l’e-mail de la demande
 * vient bien de l’adresse du compte.
 *
 * Passe uniquement par writeNutritionProfileJson (bypass never-true→false
 * et limite âge mineur pour le champ nommé).
 * Audit : userId + field + at (pas la valeur santé au-delà du nom du champ).
 */
export async function adminCorrectNutritionSafetyField(
  ctx: MutationCtx,
  args: {
    userId: string
    field: AdminCorrectableField
    value: boolean | number | null
    updatedAt?: number
  },
): Promise<{ applied: boolean }> {
  const now = args.updatedAt ?? Date.now()

  if (args.field === 'age') {
    if (args.value != null && parseValidNutritionAge(args.value) == null) {
      return { applied: false }
    }
  } else if (typeof args.value !== 'boolean') {
    return { applied: false }
  }

  await writeNutritionProfileJson(ctx, {
    userId: args.userId,
    incomingProfileJson: {},
    updatedAt: now,
    deliberate: {
      kind: 'adminCorrect',
      field: args.field,
      value: args.value,
    },
  })
  await ctx.db.insert(NUTRITION_SAFETY_ADMIN_AUDIT_TABLE, {
    userId: args.userId,
    field: args.field,
    at: now,
  })
  return { applied: true }
}
