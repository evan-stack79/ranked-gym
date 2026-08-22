import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { compressMealImage } from '../utils/compressMealImage'

export const AI_MEAL_DAILY_LIMIT = 5

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
  if (payload?.error) return payload.error

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
      return 'Serveur d’analyse indisponible — réessaie dans un instant.'
    }
  }

  if (error instanceof Error && error.message) {
    if (/failed to send a request to the edge function/i.test(error.message)) {
      return 'Impossible de joindre l’analyse IA — vérifie ta connexion.'
    }
    return error.message
  }

  return 'Échec analyse photo.'
}

/** Lecture du compteur du jour (Europe/Paris côté SQL). */
export async function getAiMealUsageToday(userId: string): Promise<AiUsageToday> {
  if (!isSupabaseConfigured()) {
    return { scanCount: 0, dailyLimit: AI_MEAL_DAILY_LIMIT, scansRemaining: AI_MEAL_DAILY_LIMIT }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ai_usage_limits')
    .select('scan_count')
    .eq('user_id', userId)
    .eq('date_of_scan', parisTodayKey())
    .maybeSingle()

  if (error) {
    console.error('[mealPhotoAi] getAiMealUsageToday:', error.message)
    return { scanCount: 0, dailyLimit: AI_MEAL_DAILY_LIMIT, scansRemaining: AI_MEAL_DAILY_LIMIT }
  }

  const scanCount = Number(data?.scan_count ?? 0)
  return {
    scanCount,
    dailyLimit: AI_MEAL_DAILY_LIMIT,
    scansRemaining: Math.max(0, AI_MEAL_DAILY_LIMIT - scanCount),
  }
}

/**
 * Compresse la photo puis appelle l’Edge Function `analyze-meal-photo`.
 */
export async function analyzeMealPhoto(file: File | Blob): Promise<MealPhotoMacros> {
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
    console.error('[mealPhotoAi] invoke failed:', error, payload)

    throw new MealPhotoAiError(friendlyInvokeMessage(error, payload), {
      code: payload?.code,
      scansRemaining: payload?.scansRemaining,
    })
  }

  if (!payload) {
    throw new MealPhotoAiError('Réponse vide du serveur d’analyse.')
  }

  if (payload.error) {
    throw new MealPhotoAiError(payload.error, {
      code: payload.code,
      scansRemaining: payload.scansRemaining,
    })
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
