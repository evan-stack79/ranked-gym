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

/** Lecture du compteur du jour (Europe/Paris côté SQL, date locale affichée). */
export async function getAiMealUsageToday(userId: string): Promise<AiUsageToday> {
  if (!isSupabaseConfigured()) {
    return { scanCount: 0, dailyLimit: AI_MEAL_DAILY_LIMIT, scansRemaining: AI_MEAL_DAILY_LIMIT }
  }

  const todayParis = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ai_usage_limits')
    .select('scan_count')
    .eq('user_id', userId)
    .eq('date_of_scan', todayParis)
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
    throw new MealPhotoAiError('Supabase non configuré.')
  }

  const compressed = await compressMealImage(file)
  const supabase = getSupabase()

  const { data, error } = await supabase.functions.invoke('analyze-meal-photo', {
    body: {
      imageBase64: compressed.base64,
      mimeType: compressed.mimeType,
    },
  })

  const payload = data as {
    error?: string
    code?: string
    calories?: number
    proteines?: number
    glucides?: number
    lipides?: number
    scanCount?: number
    dailyLimit?: number
    scansRemaining?: number
  } | null

  if (error || payload?.error) {
    console.error('[mealPhotoAi] invoke failed:', error?.message ?? payload?.error, payload)
    let message = payload?.error || error?.message || 'Échec analyse photo.'
    let code = payload?.code
    let scansRemaining = payload?.scansRemaining

    // Certaines versions exposent le body HTTP sur error.context
    const ctx = error as { context?: Response } | null
    if ((!payload || !payload.error) && ctx?.context) {
      try {
        const body = (await ctx.context.clone().json()) as typeof payload
        if (body?.error) message = body.error
        if (body?.code) code = body.code
        if (body?.scansRemaining != null) scansRemaining = body.scansRemaining
      } catch {
        // ignore parse
      }
    }

    throw new MealPhotoAiError(message, { code, scansRemaining })
  }

  if (!payload) {
    throw new MealPhotoAiError('Réponse vide.')
  }

  return {
    calories: Math.max(0, Math.round(Number(payload.calories) || 0)),
    proteines: Math.max(0, Math.round(Number(payload.proteines) || 0)),
    glucides: Math.max(0, Math.round(Number(payload.glucides) || 0)),
    lipides: Math.max(0, Math.round(Number(payload.lipides) || 0)),
    scanCount: Number(payload.scanCount ?? 0),
    dailyLimit: Number(payload.dailyLimit ?? AI_MEAL_DAILY_LIMIT),
    scansRemaining: Number(
      payload.scansRemaining ??
        Math.max(0, AI_MEAL_DAILY_LIMIT - Number(payload.scanCount ?? 0)),
    ),
  }
}
