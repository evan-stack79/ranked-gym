import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireSessionUser } from './lib/auth'
import { detectDistressLevel, type DistressLevel } from './avisDistress'
import { detectInsultWords, maskInsultWords } from './avisInsults'

export {
  detectDistressLevel,
  detectDistressSignals,
  matchesDistressPhrase,
  normalizeForMatch,
  AVIS_MOTS_DETRESSE_NIVEAU_1,
  AVIS_MOTS_DETRESSE_NIVEAU_2,
  type DistressLevel,
} from './avisDistress'

export { AVIS_MOTS_BLESSANTS, detectInsultWords, maskInsultWords } from './avisInsults'

/** Valeurs proposées (VP) — SPEC_AVIS_BETA confirmées pour cette implémentation. */
export const AVIS_TEXTE_MIN = 10
export const AVIS_TEXTE_MAX = 2000
export const AVIS_PAR_JOUR = 5
export const AVIS_ANTI_DOUBLON_MS = 2 * 60 * 1000
/** 4 essais d’envoi webhook (1 immédiat + retries). */
export const AVIS_NOTIF_MAX_ESSAIS = 4
/** Délais avant nouvel essai après échec (VP §3). */
export const AVIS_NOTIF_RETRY_DELAYS_MS = [
  1 * 60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
] as const

export const AVIS_CONSENT_VERSION = 'avis-beta-v1-2026-10-06'
export const AVIS_AGE_MIN_ADULT = 18
export const AVIS_AGE_MAX = 120

export const AVIS_BETA_MINOR_ERROR = 'AVIS_BETA_AGE_REQUIRED'
export const AVIS_BETA_DAILY_LIMIT_ERROR = 'AVIS_BETA_DAILY_LIMIT'
export const AVIS_BETA_VALIDATION_ERROR = 'AVIS_BETA_VALIDATION'
export const AVIS_BETA_CONSENT_ERROR = 'AVIS_BETA_CONSENT'

export type AvisType = 'bug' | 'idee' | 'autre'
export type AvisStatut =
  | 'nouveau'
  | 'urgent'
  | 'garde'
  | 'mis_de_cote'
  | 'transmis'
  | 'traite'
  | 'trie'
export type AvisNotif = 'a_envoyer' | 'envoyee' | 'echec'

export const AVIS_BETA_ADMIN_KEY_ENV = 'AVIS_BETA_ADMIN_KEY'
export const AVIS_BETA_ADMIN_FORBIDDEN = 'AVIS_BETA_ADMIN_FORBIDDEN'
export const AVIS_BETA_ADMIN_DEFAULT_LIMIT = 20
export const AVIS_BETA_ADMIN_MAX_LIMIT = 100

const avisStatutValidator = v.union(
  v.literal('nouveau'),
  v.literal('urgent'),
  v.literal('garde'),
  v.literal('mis_de_cote'),
  v.literal('transmis'),
  v.literal('traite'),
  v.literal('trie'),
)

const deliverAvisWebhookRef = makeFunctionReference<
  'action',
  { avisId: Id<'avis_beta'> },
  { delivered: boolean }
>('avisBeta:deliverAvisWebhook')

const markAvisNotifSentRef = makeFunctionReference<
  'mutation',
  { avisId: Id<'avis_beta'> },
  null
>('avisBeta:markAvisNotifSent')

const markAvisNotifFailedRef = makeFunctionReference<
  'mutation',
  { avisId: Id<'avis_beta'>; scheduleRetry: boolean },
  null
>('avisBeta:markAvisNotifFailed')

const loadAvisForWebhookRef = makeFunctionReference<
  'mutation',
  { avisId: Id<'avis_beta'> },
  AvisWebhookPayload | null
>('avisBeta:loadAvisForWebhook')

type SchedulerLike = {
  runAfter: MutationCtx['scheduler']['runAfter']
}

function hasScheduler(ctx: MutationCtx): ctx is MutationCtx & { scheduler: SchedulerLike } {
  const candidate = ctx as MutationCtx & { scheduler?: SchedulerLike }
  return typeof candidate.scheduler?.runAfter === 'function'
}

function startOfUtcDayMs(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function trimToEmpty(value: string | undefined): string {
  return value?.trim() ?? ''
}

/** Constant-time string compare (length mismatch fails closed without leaking content). */
export function constantTimeEqualStrings(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i] ^ rightBytes[i]
  }
  return diff === 0
}

/**
 * Admin triage gate — fail-closed if `AVIS_BETA_ADMIN_KEY` unset / empty,
 * or if the presented key does not match (constant-time compare).
 */
export function requireAvisBetaAdminKey(presented: string | undefined): void {
  const expected = trimToEmpty(readEnv(AVIS_BETA_ADMIN_KEY_ENV))
  if (!expected) {
    throw new Error(AVIS_BETA_ADMIN_FORBIDDEN)
  }
  if (!constantTimeEqualStrings(trimToEmpty(presented), expected)) {
    throw new Error(AVIS_BETA_ADMIN_FORBIDDEN)
  }
}

export function signalNiveauForPayload(
  niveau: number | undefined | null,
): 1 | 2 | null {
  if (niveau === 1 || niveau === 2) return niveau
  return null
}

/** Âge stocké serveur (nutrition_state.profileJson) — jamais lu depuis le client. */
export function isAdultStoredAge(age: unknown): age is number {
  return (
    typeof age === 'number' &&
    Number.isFinite(age) &&
    age >= AVIS_AGE_MIN_ADULT &&
    age <= AVIS_AGE_MAX
  )
}

export function extractAgeFromNutritionProfileJson(profileJson: unknown): unknown {
  if (!profileJson || typeof profileJson !== 'object') return undefined
  const record = profileJson as Record<string, unknown>
  return record.age
}

function isStoredMinorAge(age: unknown): age is number {
  return typeof age === 'number' && Number.isFinite(age) && age > 0 && age < AVIS_AGE_MIN_ADULT
}

function isPlausibleStoredAge(age: unknown): age is number {
  return typeof age === 'number' && Number.isFinite(age) && age > 0 && age <= AVIS_AGE_MAX
}

/**
 * AV-01 — refuse un saut d’âge synchronisé mineur → adulte (ex. 15 → 30).
 * Refuse aussi mineur → âge vide/invalide (contournement en deux synchros).
 * Autorise l’anniversaire : +1 an au plus (17 → 18).
 */
export function sanitizeSyncedNutritionProfileJson(
  previousProfileJson: unknown,
  incomingProfileJson: unknown,
): unknown {
  if (!incomingProfileJson || typeof incomingProfileJson !== 'object') {
    return incomingProfileJson
  }
  const prevAge = extractAgeFromNutritionProfileJson(previousProfileJson)
  const nextAge = extractAgeFromNutritionProfileJson(incomingProfileJson)
  const incoming = { ...(incomingProfileJson as Record<string, unknown>) }

  if (isStoredMinorAge(prevAge)) {
    // Contournement 15 → vide → 30 : ne pas effacer l’âge mineur.
    if (!isPlausibleStoredAge(nextAge)) {
      return { ...incoming, age: prevAge }
    }
    // Saut vers adulte : seulement +1 an max (anniversaire).
    if (isAdultStoredAge(nextAge) && nextAge > prevAge + 1) {
      return { ...incoming, age: prevAge }
    }
  }
  return incomingProfileJson
}

/**
 * Garde 18+ fail-closed : lit l’âge déjà synchronisé dans Convex.
 * Ne fait confiance à aucune valeur client. Ne stocke pas l’âge sur l’avis.
 */
export async function assertAdultFromStoredProfile(
  ctx: MutationCtx | QueryCtx,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: typeof AVIS_BETA_MINOR_ERROR }> {
  const nutrition = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const age = extractAgeFromNutritionProfileJson(nutrition?.profileJson)
  if (!isAdultStoredAge(age)) {
    return { ok: false, error: AVIS_BETA_MINOR_ERROR }
  }
  return { ok: true }
}

export function validateAvisTexte(texte: string): { ok: true; texte: string } | { ok: false; reason: string } {
  const trimmed = texte.trim()
  if (trimmed.length < AVIS_TEXTE_MIN) {
    return { ok: false, reason: 'too_short' }
  }
  if (trimmed.length > AVIS_TEXTE_MAX) {
    return { ok: false, reason: 'too_long' }
  }
  return { ok: true, texte: trimmed }
}

export type SubmitAvisInput = {
  sessionToken: string
  type: AvisType
  texte: string
  page: string
  version: string
  cleAntiDoublon: string
  consentementAccepte: boolean
  forcerEnvoiAvecInsultes?: boolean
  now?: number
}

export type SubmitAvisResult =
  | {
      ok: true
      avisId: Id<'avis_beta'>
      statut: AvisStatut
      signalUrgent: boolean
      /** 0 aucun · 1 TCA/mal-être · 2 idées suicidaires (l’emporte si les deux). */
      distressLevel: DistressLevel
      motsMasques: boolean
      duplicate: boolean
      needsReformulation: boolean
    }
  | {
      ok: false
      error:
        | typeof AVIS_BETA_MINOR_ERROR
        | typeof AVIS_BETA_DAILY_LIMIT_ERROR
        | typeof AVIS_BETA_VALIDATION_ERROR
        | typeof AVIS_BETA_CONSENT_ERROR
      reason?: string
      needsReformulation?: boolean
    }

export type AvisWebhookPayload = {
  id: string
  type: AvisType
  texte: string
  page: string
  version: string
  date: string
  id_utilisateur_hache: string
  statut: AvisStatut
  signalUrgent: boolean
  /** 1 = TCA/mal-être · 2 = idées suicidaires · null = pas de signal. */
  signalNiveau: 1 | 2 | null
}

export type AvisTriageItem = {
  id: string
  type: AvisType
  texte: string
  page: string
  version: string
  creeLe: number
  statut: AvisStatut
  signalUrgent: boolean
  signalNiveau: 1 | 2 | null
  motsMasques: boolean
  decision?: string
  noteTri?: string
  id_utilisateur_hache: string
}

export type AvisTriageListResult = {
  items: AvisTriageItem[]
  nextCursor: string | null
}

type AvisTriageCursor = {
  phase: AvisStatut
  creeLe: number
  id: string
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashUserIdForWebhook(userId: string, salt: string): Promise<string> {
  return hmacSha256Hex(salt, userId)
}

function toIsoUtcZ(ms: number): string {
  return new Date(ms).toISOString()
}

export async function countAvisTodayForUser(
  ctx: MutationCtx | QueryCtx,
  userId: string,
  now: number,
): Promise<number> {
  const dayStart = startOfUtcDayMs(now)
  const rows = await ctx.db
    .query('avis_beta')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  return rows.filter((row) => row.creeLe >= dayStart).length
}

/** Niveau max des avis urgents du jour (0 si aucun). */
export async function maxUrgentNiveauToday(
  ctx: MutationCtx | QueryCtx,
  userId: string,
  now: number,
): Promise<0 | 1 | 2> {
  const dayStart = startOfUtcDayMs(now)
  const rows = await ctx.db
    .query('avis_beta')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  let max: 0 | 1 | 2 = 0
  for (const row of rows) {
    if (!row.signalUrgent || row.creeLe < dayStart) continue
    const niveau = (row.signalNiveau === 1 || row.signalNiveau === 2
      ? row.signalNiveau
      : 1) as 1 | 2
    if (niveau > max) max = niveau
  }
  return max
}

export async function submitAvisBetaForSession(
  ctx: MutationCtx,
  input: SubmitAvisInput,
): Promise<SubmitAvisResult> {
  const user = await requireSessionUser(ctx, input.sessionToken)
  const now = input.now ?? Date.now()

  // AV-01 : 18+ depuis nutrition_state serveur uniquement (fail-closed).
  const ageGate = await assertAdultFromStoredProfile(ctx, user.userId)
  if (!ageGate.ok) {
    return { ok: false, error: ageGate.error }
  }

  if (!input.consentementAccepte) {
    return { ok: false, error: AVIS_BETA_CONSENT_ERROR }
  }

  const page = input.page.trim().slice(0, 120)
  const version = input.version.trim().slice(0, 64)
  const cle = input.cleAntiDoublon.trim().slice(0, 128)
  if (!page || !version || !cle) {
    return { ok: false, error: AVIS_BETA_VALIDATION_ERROR, reason: 'missing_meta' }
  }
  if (input.type !== 'bug' && input.type !== 'idee' && input.type !== 'autre') {
    return { ok: false, error: AVIS_BETA_VALIDATION_ERROR, reason: 'bad_type' }
  }

  const texteCheck = validateAvisTexte(input.texte)
  if (!texteCheck.ok) {
    return { ok: false, error: AVIS_BETA_VALIDATION_ERROR, reason: texteCheck.reason }
  }
  const texte = texteCheck.texte

  const existingByKey = await ctx.db
    .query('avis_beta')
    .withIndex('by_cleAntiDoublon', (q) => q.eq('cleAntiDoublon', cle))
    .first()
  if (existingByKey && existingByKey.userId === user.userId) {
    const level = (existingByKey.signalNiveau ??
      (existingByKey.signalUrgent ? detectDistressLevel(existingByKey.texte) : 0)) as DistressLevel
    return {
      ok: true,
      avisId: existingByKey._id,
      statut: existingByKey.statut,
      signalUrgent: existingByKey.signalUrgent,
      distressLevel: level,
      motsMasques: existingByKey.motsMasques,
      duplicate: true,
      needsReformulation: false,
    }
  }

  const recent = await ctx.db
    .query('avis_beta')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .collect()
  const sameText = recent.find(
    (row) => row.texte === texte && row.creeLe >= now - AVIS_ANTI_DOUBLON_MS,
  )
  if (sameText) {
    const level = (sameText.signalNiveau ??
      (sameText.signalUrgent ? detectDistressLevel(sameText.texte) : 0)) as DistressLevel
    return {
      ok: true,
      avisId: sameText._id,
      statut: sameText.statut,
      signalUrgent: sameText.signalUrgent,
      distressLevel: level,
      motsMasques: sameText.motsMasques,
      duplicate: true,
      needsReformulation: false,
    }
  }

  // AV-04 / AV-05 : détresse avant limite journalière et filtre insultes.
  const distressLevel = detectDistressLevel(texte)
  const signalUrgent = distressLevel > 0

  // AV-23 : toujours enregistrer la détresse ; seule la notification est limitée.
  // Une notif part encore si le niveau monte (1 → 2).
  let scheduleNotif = true
  if (signalUrgent) {
    const maxToday = await maxUrgentNiveauToday(ctx, user.userId, now)
    scheduleNotif = maxToday === 0 || distressLevel > maxToday
  } else {
    const todayCount = await countAvisTodayForUser(ctx, user.userId, now)
    if (todayCount >= AVIS_PAR_JOUR) {
      return { ok: false, error: AVIS_BETA_DAILY_LIMIT_ERROR }
    }
  }

  const insults = detectInsultWords(texte)
  // Détresse : envoi avec masquage auto (pas d’écran « reformuler »).
  if (insults.length > 0 && !signalUrgent && !input.forcerEnvoiAvecInsultes) {
    return {
      ok: false,
      error: AVIS_BETA_VALIDATION_ERROR,
      reason: 'insults',
      needsReformulation: true,
    }
  }

  const motsMasques = insults.length > 0
  const texteMasque = motsMasques ? maskInsultWords(texte, insults) : undefined
  const statut: AvisStatut = signalUrgent ? 'urgent' : 'nouveau'
  // Notif volontairement non envoyée (déjà un signal du même niveau aujourd’hui).
  const notif: AvisNotif = scheduleNotif ? 'a_envoyer' : 'envoyee'

  const avisId = await ctx.db.insert('avis_beta', {
    userId: user.userId,
    type: input.type,
    texte,
    texteMasque,
    page,
    version,
    creeLe: now,
    consentementDate: now,
    consentementVersion: AVIS_CONSENT_VERSION,
    statut,
    signalUrgent,
    signalNiveau: distressLevel === 1 || distressLevel === 2 ? distressLevel : undefined,
    motsMasques,
    notif,
    notifEssais: 0,
    cleAntiDoublon: cle,
  })

  if (scheduleNotif && hasScheduler(ctx)) {
    await ctx.scheduler.runAfter(0, deliverAvisWebhookRef, { avisId })
  }

  return {
    ok: true,
    avisId,
    statut,
    signalUrgent,
    distressLevel,
    motsMasques,
    duplicate: false,
    needsReformulation: false,
  }
}

export async function listOwnAvisBetaForSession(
  ctx: QueryCtx,
  sessionToken: string,
): Promise<
  Array<{
    avisId: Id<'avis_beta'>
    type: AvisType
    page: string
    version: string
    creeLe: number
    statut: AvisStatut
  }>
> {
  const user = await requireSessionUser(ctx, sessionToken)
  const rows = await ctx.db
    .query('avis_beta')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .collect()
  return rows
    .slice()
    .sort((a, b) => a.creeLe - b.creeLe)
    .map((row) => ({
      avisId: row._id,
      type: row.type,
      page: row.page,
      version: row.version,
      creeLe: row.creeLe,
      statut: row.statut,
    }))
}

export async function deleteAvisBetaForUser(ctx: MutationCtx, userId: string): Promise<number> {
  const rows = await ctx.db
    .query('avis_beta')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  for (const row of rows) {
    await ctx.db.delete(row._id)
  }
  return rows.length
}

export function buildWebhookJsonBody(payload: AvisWebhookPayload): string {
  // Ordre stable des clés pour signature HMAC.
  return JSON.stringify({
    id: payload.id,
    type: payload.type,
    texte: payload.texte,
    page: payload.page,
    version: payload.version,
    date: payload.date,
    id_utilisateur_hache: payload.id_utilisateur_hache,
    statut: payload.statut,
    signalUrgent: payload.signalUrgent,
    signalNiveau: payload.signalNiveau,
  })
}

function encodeTriageCursor(cursor: AvisTriageCursor): string {
  return JSON.stringify(cursor)
}

function decodeTriageCursor(raw: string | undefined): AvisTriageCursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AvisTriageCursor>
    if (
      typeof parsed.phase !== 'string' ||
      typeof parsed.creeLe !== 'number' ||
      typeof parsed.id !== 'string'
    ) {
      return null
    }
    return {
      phase: parsed.phase as AvisStatut,
      creeLe: parsed.creeLe,
      id: parsed.id,
    }
  } catch {
    return null
  }
}

function compareAvisTriageOrder(
  a: { creeLe: number; _id: string },
  b: { creeLe: number; _id: string },
): number {
  // Plus récent d’abord, puis id stable.
  if (a.creeLe !== b.creeLe) return b.creeLe - a.creeLe
  return String(a._id).localeCompare(String(b._id))
}

function isAfterTriageCursor(
  row: { creeLe: number; _id: string },
  cursor: AvisTriageCursor,
): boolean {
  if (row.creeLe < cursor.creeLe) return true
  if (row.creeLe > cursor.creeLe) return false
  return String(row._id).localeCompare(cursor.id) > 0
}

async function mapAvisRowToTriageItem(
  row: {
    _id: Id<'avis_beta'> | string
    type: AvisType
    texte: string
    texteMasque?: string
    page: string
    version: string
    creeLe: number
    statut: AvisStatut
    signalUrgent: boolean
    signalNiveau?: 1 | 2
    motsMasques: boolean
    decision?: string
    noteTri?: string
    userId: string
  },
  salt: string,
): Promise<AvisTriageItem> {
  const hashed = await hashUserIdForWebhook(row.userId, salt)
  return {
    id: String(row._id),
    type: row.type,
    texte: row.texteMasque ?? row.texte,
    page: row.page,
    version: row.version,
    creeLe: row.creeLe,
    statut: row.statut,
    signalUrgent: row.signalUrgent,
    signalNiveau: signalNiveauForPayload(row.signalNiveau),
    motsMasques: row.motsMasques,
    decision: row.decision,
    noteTri: row.noteTri,
    id_utilisateur_hache: hashed,
  }
}

/**
 * Liste admin — urgent d’abord puis nouveau (index `by_statut`), pagination par curseur.
 * Ne renvoie jamais le userId brut ni l’âge.
 */
export async function listAvisBetaForTriage(
  ctx: QueryCtx,
  args: {
    adminKey: string
    statut?: AvisStatut
    limit?: number
    cursor?: string
  },
): Promise<AvisTriageListResult> {
  requireAvisBetaAdminKey(args.adminKey)
  const salt = trimToEmpty(readEnv('AVIS_BETA_USER_HASH_SALT'))
  if (!salt) {
    throw new Error(AVIS_BETA_ADMIN_FORBIDDEN)
  }

  const limit = Math.min(
    Math.max(1, Math.floor(args.limit ?? AVIS_BETA_ADMIN_DEFAULT_LIMIT)),
    AVIS_BETA_ADMIN_MAX_LIMIT,
  )
  const phases: AvisStatut[] = args.statut
    ? [args.statut]
    : ['urgent', 'nouveau']
  const cursor = decodeTriageCursor(args.cursor)
  const startPhaseIndex = cursor
    ? Math.max(0, phases.indexOf(cursor.phase))
    : 0

  const picked: Array<{
    _id: Id<'avis_beta'> | string
    type: AvisType
    texte: string
    texteMasque?: string
    page: string
    version: string
    creeLe: number
    statut: AvisStatut
    signalUrgent: boolean
    signalNiveau?: 1 | 2
    motsMasques: boolean
    decision?: string
    noteTri?: string
    userId: string
  }> = []

  for (let i = startPhaseIndex; i < phases.length && picked.length < limit + 1; i += 1) {
    const phase = phases[i]!
    const rows = await ctx.db
      .query('avis_beta')
      .withIndex('by_statut', (q) => q.eq('statut', phase))
      .collect()
    const sorted = rows.slice().sort(compareAvisTriageOrder)
    for (const row of sorted) {
      if (cursor && phase === cursor.phase && !isAfterTriageCursor(row, cursor)) {
        continue
      }
      picked.push(row)
      if (picked.length >= limit + 1) break
    }
  }

  const page = picked.slice(0, limit)
  const hasMore = picked.length > limit
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeTriageCursor({
          phase: last.statut,
          creeLe: last.creeLe,
          id: String(last._id),
        })
      : null

  const items = await Promise.all(page.map((row) => mapAvisRowToTriageItem(row, salt)))
  return { items, nextCursor }
}

export type TriageAvisInput = {
  adminKey: string
  avisId: Id<'avis_beta'>
  decision: string
  noteTri: string
  statut?: AvisStatut
}

export type TriageAvisResult =
  | {
      ok: true
      avisId: Id<'avis_beta'>
      statut: AvisStatut
      decision: string
      noteTri: string
    }
  | { ok: false; error: string }

/**
 * Mutation admin — pose `decision` + `noteTri`, et optionnellement `statut` (ex. `trie`).
 */
export async function triageAvisBeta(
  ctx: MutationCtx,
  input: TriageAvisInput,
): Promise<TriageAvisResult> {
  requireAvisBetaAdminKey(input.adminKey)

  const decision = input.decision.trim().slice(0, 200)
  const noteTri = input.noteTri.trim().slice(0, 2000)
  if (!decision) {
    return { ok: false, error: AVIS_BETA_VALIDATION_ERROR }
  }

  const row = await ctx.db.get(input.avisId)
  if (!row) {
    return { ok: false, error: 'AVIS_BETA_NOT_FOUND' }
  }

  const patch: {
    decision: string
    noteTri: string
    statut?: AvisStatut
  } = { decision, noteTri }
  if (input.statut) {
    patch.statut = input.statut
  }
  await ctx.db.patch(input.avisId, patch)

  return {
    ok: true,
    avisId: input.avisId,
    statut: input.statut ?? row.statut,
    decision,
    noteTri,
  }
}

export const submitAvis = mutation({
  args: {
    sessionToken: v.string(),
    type: v.union(v.literal('bug'), v.literal('idee'), v.literal('autre')),
    texte: v.string(),
    page: v.string(),
    version: v.string(),
    cleAntiDoublon: v.string(),
    consentementAccepte: v.boolean(),
    forcerEnvoiAvecInsultes: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      avisId: v.id('avis_beta'),
      statut: avisStatutValidator,
      signalUrgent: v.boolean(),
      distressLevel: v.union(v.literal(0), v.literal(1), v.literal(2)),
      motsMasques: v.boolean(),
      duplicate: v.boolean(),
      needsReformulation: v.boolean(),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      reason: v.optional(v.string()),
      needsReformulation: v.optional(v.boolean()),
    }),
  ),
  handler: (ctx, args) => submitAvisBetaForSession(ctx, args),
})

export const listOwnAvis = query({
  args: { sessionToken: v.string() },
  returns: v.array(
    v.object({
      avisId: v.id('avis_beta'),
      type: v.union(v.literal('bug'), v.literal('idee'), v.literal('autre')),
      page: v.string(),
      version: v.string(),
      creeLe: v.number(),
      statut: avisStatutValidator,
    }),
  ),
  handler: (ctx, args) => listOwnAvisBetaForSession(ctx, args.sessionToken),
})

const avisTriageItemValidator = v.object({
  id: v.string(),
  type: v.union(v.literal('bug'), v.literal('idee'), v.literal('autre')),
  texte: v.string(),
  page: v.string(),
  version: v.string(),
  creeLe: v.number(),
  statut: avisStatutValidator,
  signalUrgent: v.boolean(),
  signalNiveau: v.union(v.literal(1), v.literal(2), v.null()),
  motsMasques: v.boolean(),
  decision: v.optional(v.string()),
  noteTri: v.optional(v.string()),
  id_utilisateur_hache: v.string(),
})

/** Admin triage list — requires `AVIS_BETA_ADMIN_KEY` (fail-closed if unset). */
export const listAvisForTriage = query({
  args: {
    adminKey: v.string(),
    statut: v.optional(avisStatutValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    items: v.array(avisTriageItemValidator),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: (ctx, args) => listAvisBetaForTriage(ctx, args),
})

/** Admin triage mutation — sets decision/noteTri (+ optional statut). */
export const triageAvis = mutation({
  args: {
    adminKey: v.string(),
    avisId: v.id('avis_beta'),
    decision: v.string(),
    noteTri: v.string(),
    statut: v.optional(avisStatutValidator),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      avisId: v.id('avis_beta'),
      statut: avisStatutValidator,
      decision: v.string(),
      noteTri: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: (ctx, args) => triageAvisBeta(ctx, args),
})

export const loadAvisForWebhook = internalMutation({
  args: { avisId: v.id('avis_beta') },
  returns: v.union(
    v.object({
      id: v.string(),
      type: v.union(v.literal('bug'), v.literal('idee'), v.literal('autre')),
      texte: v.string(),
      page: v.string(),
      version: v.string(),
      date: v.string(),
      id_utilisateur_hache: v.string(),
      statut: avisStatutValidator,
      signalUrgent: v.boolean(),
      signalNiveau: v.union(v.literal(1), v.literal(2), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.avisId)
    if (!row) return null
    if (row.notif === 'envoyee') return null
    if (row.notifEssais >= AVIS_NOTIF_MAX_ESSAIS) {
      if (row.notif !== 'echec') {
        await ctx.db.patch(args.avisId, { notif: 'echec' })
      }
      return null
    }

    const salt = readEnv('AVIS_BETA_USER_HASH_SALT')?.trim()
    const url = readEnv('AVIS_BETA_WEBHOOK_URL')?.trim()
    if (!salt || !url) {
      console.info('[avis-beta] webhook env incomplete — avis kept, notif pending')
      return null
    }

    await ctx.db.patch(args.avisId, {
      notifEssais: row.notifEssais + 1,
    })

    const hashed = await hashUserIdForWebhook(row.userId, salt)
    return {
      id: String(row._id),
      type: row.type,
      texte: row.texteMasque ?? row.texte,
      page: row.page,
      version: row.version,
      date: toIsoUtcZ(row.creeLe),
      id_utilisateur_hache: hashed,
      statut: row.statut,
      signalUrgent: row.signalUrgent,
      signalNiveau: signalNiveauForPayload(row.signalNiveau),
    } satisfies AvisWebhookPayload
  },
})

export const markAvisNotifSent = internalMutation({
  args: { avisId: v.id('avis_beta') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.avisId)
    if (!row) return null
    await ctx.db.patch(args.avisId, { notif: 'envoyee' })
    return null
  },
})

export const markAvisNotifFailed = internalMutation({
  args: {
    avisId: v.id('avis_beta'),
    scheduleRetry: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.avisId)
    if (!row) return null
    if (row.notifEssais >= AVIS_NOTIF_MAX_ESSAIS) {
      await ctx.db.patch(args.avisId, { notif: 'echec' })
      return null
    }
    await ctx.db.patch(args.avisId, { notif: 'a_envoyer' })
    if (args.scheduleRetry && hasScheduler(ctx)) {
      const delayIndex = Math.min(row.notifEssais - 1, AVIS_NOTIF_RETRY_DELAYS_MS.length - 1)
      const delay = AVIS_NOTIF_RETRY_DELAYS_MS[Math.max(0, delayIndex)] ?? AVIS_NOTIF_RETRY_DELAYS_MS[0]
      await ctx.scheduler.runAfter(delay, deliverAvisWebhookRef, { avisId: args.avisId })
    }
    return null
  },
})

async function postAvisWebhook(
  payload: AvisWebhookPayload,
): Promise<{ ok: boolean; configured: boolean }> {
  const url = readEnv('AVIS_BETA_WEBHOOK_URL')?.trim()
  const secret = readEnv('AVIS_BETA_WEBHOOK_SECRET')?.trim()
  if (!url) {
    console.info('[avis-beta] AVIS_BETA_WEBHOOK_URL missing — avis kept, notif left pending')
    return { ok: false, configured: false }
  }

  const body = buildWebhookJsonBody(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (secret) {
    const signature = await hmacSha256Hex(secret, body)
    headers['X-Ranked-Gym-Signature'] = signature
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })
    return { ok: response.ok, configured: true }
  } catch (error) {
    console.info('[avis-beta] webhook fetch failed', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    return { ok: false, configured: true }
  }
}

export const deliverAvisWebhook = internalAction({
  args: { avisId: v.id('avis_beta') },
  returns: v.object({ delivered: v.boolean() }),
  handler: async (ctx, args) => {
    const payload = await ctx.runMutation(loadAvisForWebhookRef, { avisId: args.avisId })
    if (!payload) {
      return { delivered: false }
    }
    const result = await postAvisWebhook(payload)
    if (result.ok) {
      await ctx.runMutation(markAvisNotifSentRef, { avisId: args.avisId })
      return { delivered: true }
    }
    // Pas d’URL configurée : on ne brûle pas les retries (avis déjà sauvé).
    await ctx.runMutation(markAvisNotifFailedRef, {
      avisId: args.avisId,
      scheduleRetry: result.configured,
    })
    return { delivered: false }
  },
})
