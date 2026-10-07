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

export {
  detectDistressLevel,
  detectDistressSignals,
  matchesDistressPhrase,
  normalizeForMatch,
  AVIS_MOTS_DETRESSE_NIVEAU_1,
  AVIS_MOTS_DETRESSE_NIVEAU_2,
  type DistressLevel,
} from './avisDistress'

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
export type AvisNotif = 'a_envoyer' | 'envoyee' | 'echec'

/**
 * Liste courte de mots blessants (FR) — masqués côté serveur, jamais bloquants.
 * À enrichir avec le Vérificateur ; volontairement minimale en V1.
 */
export const AVIS_MOTS_BLESSANTS = [
  'connard',
  'connasse',
  'salope',
  'pute',
  'enculé',
  'encule',
  'pd',
  'fdp',
  'ntm',
  'nique',
  'niquer',
  'putain',
  'merde',
  'connerie',
] as const

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

export function isAdultDeclaredAge(age: unknown): age is number {
  return (
    typeof age === 'number' &&
    Number.isFinite(age) &&
    Number.isInteger(age) &&
    age >= AVIS_AGE_MIN_ADULT &&
    age <= AVIS_AGE_MAX
  )
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeInsultHaystack(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, "'")
    .toLowerCase()
}

export function detectInsultWords(texte: string): string[] {
  const normalized = normalizeInsultHaystack(texte)
  const hits: string[] = []
  for (const word of AVIS_MOTS_BLESSANTS) {
    const needle = normalizeInsultHaystack(word)
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(needle)}(?:[^\\p{L}\\p{N}]|$)`, 'u')
    if (pattern.test(normalized)) hits.push(word)
  }
  return hits
}

/** Remplace les mots blessants par ••• (version transmise / masquée). */
export function maskInsultWords(texte: string, insults: string[] = detectInsultWords(texte)): string {
  if (insults.length === 0) return texte
  let result = texte
  for (const word of insults) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(word)}(?![\\p{L}\\p{N}])`, 'giu')
    result = result.replace(pattern, '•••')
  }
  return result
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
  /** Âge déclaré — validé puis non stocké (garde 18+). */
  declaredAge: number
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

export async function submitAvisBetaForSession(
  ctx: MutationCtx,
  input: SubmitAvisInput,
): Promise<SubmitAvisResult> {
  const user = await requireSessionUser(ctx, input.sessionToken)
  const now = input.now ?? Date.now()

  if (!isAdultDeclaredAge(input.declaredAge)) {
    return { ok: false, error: AVIS_BETA_MINOR_ERROR }
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

  const todayCount = await countAvisTodayForUser(ctx, user.userId, now)
  if (todayCount >= AVIS_PAR_JOUR) {
    return { ok: false, error: AVIS_BETA_DAILY_LIMIT_ERROR }
  }

  const insults = detectInsultWords(texte)
  if (insults.length > 0 && !input.forcerEnvoiAvecInsultes) {
    return {
      ok: false,
      error: AVIS_BETA_VALIDATION_ERROR,
      reason: 'insults',
      needsReformulation: true,
    }
  }

  const motsMasques = insults.length > 0
  const texteMasque = motsMasques ? maskInsultWords(texte, insults) : undefined
  const distressLevel = detectDistressLevel(texte)
  const signalUrgent = distressLevel > 0
  const statut: AvisStatut = signalUrgent ? 'urgent' : 'nouveau'

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
    notif: 'a_envoyer',
    notifEssais: 0,
    cleAntiDoublon: cle,
  })

  if (hasScheduler(ctx)) {
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
  })
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
    declaredAge: v.number(),
    forcerEnvoiAvecInsultes: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      avisId: v.id('avis_beta'),
      statut: v.union(
        v.literal('nouveau'),
        v.literal('urgent'),
        v.literal('garde'),
        v.literal('mis_de_cote'),
        v.literal('transmis'),
        v.literal('traite'),
      ),
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
      statut: v.union(
        v.literal('nouveau'),
        v.literal('urgent'),
        v.literal('garde'),
        v.literal('mis_de_cote'),
        v.literal('transmis'),
        v.literal('traite'),
      ),
    }),
  ),
  handler: (ctx, args) => listOwnAvisBetaForSession(ctx, args.sessionToken),
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

    const salt = process.env.AVIS_BETA_USER_HASH_SALT?.trim()
    const url = process.env.AVIS_BETA_WEBHOOK_URL?.trim()
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
  const url = process.env.AVIS_BETA_WEBHOOK_URL?.trim()
  const secret = process.env.AVIS_BETA_WEBHOOK_SECRET?.trim()
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
