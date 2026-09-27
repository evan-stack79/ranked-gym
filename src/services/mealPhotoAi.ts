import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { compressMealImage } from '../utils/compressMealImage'
import {
  AI_UNAVAILABLE_FR,
  sanitizeMealPhotoAiClientMessage,
} from '../utils/geminiMealPhotoRetry'
import { safeError } from '../utils/safeLog'
import { runWithDomainBackend } from '../backend/domainBackend'
import { isConvexDomainActive } from '../backend/adapter'
import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

export const AI_MEAL_DAILY_LIMIT = 5
const CONVEX_MAX_BASE64_CHARS = 900_000
const api = generatedApi as any

export type MealPhotoMacros = {
  calories: number
  proteines: number
  glucides: number
  lipides: number
  scanCount: number
  dailyLimit: number
  scansRemaining: number
}

export class MealPhotoAiError extends Error {
  code?: string
  scansRemaining?: number

  constructor(message: string, opts?: { code?: string; scansRemaining?: number }) {
    super(message)
    this.name = 'MealPhotoAiError'
    this.code = opts?.code
    this.scansRemaining = opts?.scansRemaining
  }
}

export type AiUsageToday = {
  scanCount: number
  dailyLimit: number
  scansRemaining: number
}

type InvokePayload = {
  error?: string
  code?: string
  calories?: number
  proteines?: number
  glucides?: number
  lipides?: number
  scanCount?: number
  dailyLimit?: number
  scansRemaining?: number
}

type ConvexAnalyzePayload =
  | {
      ok: true
      calories: number
      proteines: number
      glucides: number
      lipides: number
      scanCount: number
      dailyLimit: number
      scansRemaining: number
    }
  | {
      ok: false
      error: string
      code: string
      scanCount?: number
      dailyLimit?: number
      scansRemaining?: number
    }

function parisTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function normalizePayload(raw: unknown): InvokePayload | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as InvokePayload
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as InvokePayload
  return null
}

async function readFunctionErrorBody(error: unknown): Promise<InvokePayload | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  try {
    return normalizePayload(await error.context.json())
  } catch {
    return null
  }
}

function friendlyInvokeMessage(error: unknown, payload: InvokePayload | null): string {
  const httpStatus =
    error instanceof FunctionsHttpError ? error.context.status : undefined

  if (payload?.error) {
    return sanitizeMealPhotoAiClientMessage(payload.error, {
      httpStatus,
      code: payload.code,
    })
  }

  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 401) {
      return 'Session expirée — reconnecte-toi pour analyser une photo.'
    }
    if (error.context.status === 429) {
      return `Limite atteinte : ${AI_MEAL_DAILY_LIMIT} analyses photo / jour.`
    }
    if (error.context.status === 404) {
      return 'Fonction analyze-meal-photo introuvable (déploiement Supabase requis).'
    }
    if (error.context.status >= 500) {
      return AI_UNAVAILABLE_FR
    }
  }

  if (error instanceof Error && error.message) {
    if (/failed to send a request to the edge function/i.test(error.message)) {
      return 'Impossible de joindre l’analyse IA — vérifie ta connexion.'
    }
    return sanitizeMealPhotoAiClientMessage(error.message, { httpStatus })
  }

  return 'Échec analyse photo.'
}

function invokeFailureSummary(error: unknown, payload: InvokePayload | null) {
  const status =
    error instanceof FunctionsHttpError ? error.context.status : undefined
  return {
    status,
    code: payload?.code ?? null,
    hasPayloadError: Boolean(payload?.error),
  }
}

function normalizeConvexPayload(raw: unknown): ConvexAnalyzePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as Partial<ConvexAnalyzePayload>
  if (payload.ok === true) {
    return {
      ok: true,
      calories: Number(payload.calories ?? 0),
      proteines: Number(payload.proteines ?? 0),
      glucides: Number(payload.glucides ?? 0),
      lipides: Number(payload.lipides ?? 0),
      scanCount: Number(payload.scanCount ?? 0),
      dailyLimit: Number(payload.dailyLimit ?? AI_MEAL_DAILY_LIMIT),
      scansRemaining: Number(payload.scansRemaining ?? 0),
    }
  }
  if (payload.ok === false && typeof payload.error === 'string' && typeof payload.code === 'string') {
    return {
      ok: false,
      error: payload.error,
      code: payload.code,
      scanCount: payload.scanCount == null ? undefined : Number(payload.scanCount),
      dailyLimit: payload.dailyLimit == null ? undefined : Number(payload.dailyLimit),
      scansRemaining: payload.scansRemaining == null ? undefined : Number(payload.scansRemaining),
    }
  }
  return null
}

function convexActionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('arguments size is too large') ||
    lower.includes('1mb total size limit') ||
    lower.includes('payload too large')
  ) {
    return 'Photo trop volumineuse — recadre puis réessaie.'
  }
  if (lower.includes('not authenticated') || lower.includes('auth_required')) {
    return 'Session expirée — reconnecte-toi puis réessaie.'
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('connection') ||
    lower.includes('timeout')
  ) {
    return 'Impossible de joindre le service d’analyse — vérifie ta connexion.'
  }
  return sanitizeMealPhotoAiClientMessage(message)
}

/** Lecture du compteur du jour (Europe/Paris côté SQL). */
export async function getAiMealUsageToday(userId: string): Promise<AiUsageToday> {
  try {
    return await runWithDomainBackend<AiUsageToday>({
      operation: 'mealPhotoAi.usage',
      convex: async () => {
        const sessionToken = await getConvexSessionToken()
        if (!sessionToken) {
          return {
            scanCount: 0,
            dailyLimit: AI_MEAL_DAILY_LIMIT,
            scansRemaining: AI_MEAL_DAILY_LIMIT,
          }
        }
        const row = (await getConvex().query(api.rpc.getAiMealUsageToday, {
          sessionToken,
        })) as { scan_count: number; daily_limit: number }
        const scanCount = Number(row.scan_count ?? 0)
        const dailyLimit = Number(row.daily_limit ?? AI_MEAL_DAILY_LIMIT)
        return {
          scanCount,
          dailyLimit,
          scansRemaining: Math.max(0, dailyLimit - scanCount),
        }
      },
      supabase: async () => {
        if (!isSupabaseConfigured()) {
          return {
            scanCount: 0,
            dailyLimit: AI_MEAL_DAILY_LIMIT,
            scansRemaining: AI_MEAL_DAILY_LIMIT,
          }
        }
        const supabase = getSupabase()
        const { data, error } = await supabase
          .from('ai_usage_limits')
          .select('scan_count')
          .eq('user_id', userId)
          .eq('date_of_scan', parisTodayKey())
          .maybeSingle()

        if (error) {
          safeError('[mealPhotoAi] getAiMealUsageToday', error.message)
          return {
            scanCount: 0,
            dailyLimit: AI_MEAL_DAILY_LIMIT,
            scansRemaining: AI_MEAL_DAILY_LIMIT,
          }
        }

        const scanCount = Number(data?.scan_count ?? 0)
        return {
          scanCount,
          dailyLimit: AI_MEAL_DAILY_LIMIT,
          scansRemaining: Math.max(0, AI_MEAL_DAILY_LIMIT - scanCount),
        }
      },
    })
  } catch (error) {
    safeError('[mealPhotoAi] usage backend failure', error)
    return { scanCount: 0, dailyLimit: AI_MEAL_DAILY_LIMIT, scansRemaining: AI_MEAL_DAILY_LIMIT }
  }
}

/**
 * Compresse la photo puis appelle l’Edge Function `analyze-meal-photo`.
 * Technical exception during migration: AI inference provider remains Supabase Edge.
 * Durable meal data is still stored through the app nutrition journal sync layer.
 */
export async function analyzeMealPhoto(file: File | Blob): Promise<MealPhotoMacros> {
  if (isConvexDomainActive()) {
    const sessionToken = await getConvexSessionToken()
    if (!sessionToken) {
      throw new MealPhotoAiError('Session expirée — reconnecte-toi puis réessaie.', {
        code: 'AUTH_REQUIRED',
      })
    }

    const compressed = await compressMealImage(file)
    if (compressed.base64.length > CONVEX_MAX_BASE64_CHARS) {
      throw new MealPhotoAiError('Photo trop volumineuse — recadre puis réessaie.', {
        code: 'IMAGE_TOO_LARGE',
      })
    }

    let raw: unknown
    try {
      raw = await getConvex().action(api.mealPhotoAi.analyzeMealPhoto, {
        sessionToken,
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
      })
    } catch (error) {
      safeError('[mealPhotoAi] convex action failed', error)
      throw new MealPhotoAiError(convexActionErrorMessage(error), { code: 'ai_error' })
    }

    const payload = normalizeConvexPayload(raw)
    if (!payload) {
      throw new MealPhotoAiError('Réponse vide du serveur d’analyse.')
    }

    if (!payload.ok) {
      throw new MealPhotoAiError(
        sanitizeMealPhotoAiClientMessage(payload.error, { code: payload.code }),
        {
          code: payload.code,
          scansRemaining: payload.scansRemaining,
        },
      )
    }

    const calories = Math.max(0, Math.round(Number(payload.calories) || 0))
    if (calories <= 0) {
      throw new MealPhotoAiError(
        'Gemini n’a pas pu estimer les macros — reprends la photo (repas visible, bon éclairage).',
        { code: 'EMPTY_MACROS', scansRemaining: payload.scansRemaining },
      )
    }

    const scanCount = Number(payload.scanCount ?? 0)
    const dailyLimit = Number(payload.dailyLimit ?? AI_MEAL_DAILY_LIMIT)
    return {
      calories,
      proteines: Math.max(0, Math.round(Number(payload.proteines) || 0)),
      glucides: Math.max(0, Math.round(Number(payload.glucides) || 0)),
      lipides: Math.max(0, Math.round(Number(payload.lipides) || 0)),
      scanCount,
      dailyLimit,
      scansRemaining: Number(payload.scansRemaining ?? Math.max(0, dailyLimit - scanCount)),
    }
  }

  if (!isSupabaseConfigured()) {
    throw new MealPhotoAiError('Supabase non configuré — connexion requise.')
  }

  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new MealPhotoAiError('Connecte-toi pour utiliser l’analyse photo.', { code: 'AUTH_REQUIRED' })
  }

  const compressed = await compressMealImage(file)

  const { data, error } = await supabase.functions.invoke('analyze-meal-photo', {
    body: {
      imageBase64: compressed.base64,
      mimeType: compressed.mimeType,
    },
  })

  let payload = normalizePayload(data)

  if (error) {
    const errorBody = await readFunctionErrorBody(error)
    if (errorBody) payload = { ...payload, ...errorBody }
    safeError('[mealPhotoAi] invoke failed', invokeFailureSummary(error, payload))

    throw new MealPhotoAiError(friendlyInvokeMessage(error, payload), {
      code: payload?.code,
      scansRemaining: payload?.scansRemaining,
    })
  }

  if (!payload) {
    throw new MealPhotoAiError('Réponse vide du serveur d’analyse.')
  }

  if (payload.error) {
    throw new MealPhotoAiError(
      sanitizeMealPhotoAiClientMessage(payload.error, { code: payload.code }),
      {
        code: payload.code,
        scansRemaining: payload.scansRemaining,
      },
    )
  }

  const calories = Math.max(0, Math.round(Number(payload.calories) || 0))
  if (calories <= 0) {
    throw new MealPhotoAiError(
      'Gemini n’a pas pu estimer les macros — reprends la photo (repas visible, bon éclairage).',
      { code: 'EMPTY_MACROS', scansRemaining: payload.scansRemaining },
    )
  }

  const scanCount = Number(payload.scanCount ?? 0)
  const dailyLimit = Number(payload.dailyLimit ?? AI_MEAL_DAILY_LIMIT)

  return {
    calories,
    proteines: Math.max(0, Math.round(Number(payload.proteines) || 0)),
    glucides: Math.max(0, Math.round(Number(payload.glucides) || 0)),
    lipides: Math.max(0, Math.round(Number(payload.lipides) || 0)),
    scanCount,
    dailyLimit,
    scansRemaining: Number(
      payload.scansRemaining ?? Math.max(0, dailyLimit - scanCount),
    ),
  }
}
