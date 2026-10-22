import { compressMealImage } from '../utils/compressMealImage'
import { sanitizeMealPhotoAiClientMessage } from '../utils/geminiMealPhotoRetry'
import { safeError } from '../utils/safeLog'
import { runWithDomainBackend } from '../backend/domainBackend'
import { isConvexDomainActive } from '../backend/adapter'
import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

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
 * V3-10 — analyse Photo IA uniquement via Convex `analyzeMealPhoto`
 * (garde âge / grossesse / allaitement serveur). Plus d’appel à l’ancienne
 * Edge Function Supabase homonyme.
 */
export async function analyzeMealPhoto(file: File | Blob): Promise<MealPhotoMacros> {
  if (!isConvexDomainActive()) {
    throw new MealPhotoAiError(
      'Analyse photo indisponible — reconnecte-toi ou mets à jour l’app.',
      { code: 'CONVEX_REQUIRED' },
    )
  }

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
