/**
 * Helper webhook « Surveillance fitness » (Grok Bot).
 * Pas de secret en dur — URL/clé lues depuis l’env Convex au runtime.
 */

export const SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV = 'SURVEILLANCE_FITNESS_WEBHOOK_URL'
export const SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV = 'SURVEILLANCE_FITNESS_WEBHOOK_KEY'

/** Seuil churn : jours sans activité avant événement `churn`. */
export const SURVEILLANCE_FITNESS_CHURN_DAYS = 14

export type SurveillanceFitnessEventType =
  | 'signup_free'
  | 'beta_signup'
  | 'first_meal_photo_ai'
  | 'first_workout'
  | 'churn'
  | 'test'

export type SurveillanceFitnessPlan = 'free' | 'beta' | 'unknown'

export type SurveillanceFitnessWebhookPayload = {
  type: SurveillanceFitnessEventType
  email: string
  last_active_days: number | null
  action_count: number | null
  plan: SurveillanceFitnessPlan
  /** ISO-8601 UTC. */
  occurred_at: string
  user_id?: string
}

export type SurveillanceFitnessPostResult = {
  ok: boolean
  /** false = env manquante → soft skip, pas de retry brûlé. */
  configured: boolean
  status?: number
  error?: string
}

export function readProcessEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

export function readSurveillanceFitnessWebhookConfig(envReader = readProcessEnv): {
  url: string | null
  key: string | null
} {
  const url = envReader(SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV)?.trim() || null
  const key = envReader(SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV)?.trim() || null
  return { url, key }
}

/** Clés stables (ordre fixe) pour un corps JSON déterministe. */
export function buildSurveillanceFitnessWebhookBody(
  payload: SurveillanceFitnessWebhookPayload,
): string {
  const ordered: Record<string, unknown> = {
    type: payload.type,
    email: payload.email,
    last_active_days: payload.last_active_days,
    action_count: payload.action_count,
    plan: payload.plan,
    occurred_at: payload.occurred_at,
  }
  if (payload.user_id) ordered.user_id = payload.user_id
  return JSON.stringify(ordered)
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number }>

/**
 * POST JSON vers le webhook Surveillance fitness.
 * Header `Authorization: Bearer <clé>`. Env absente → soft skip (configured: false).
 */
export async function postSurveillanceFitnessWebhook(
  payload: SurveillanceFitnessWebhookPayload,
  options?: {
    fetchImpl?: FetchLike
    envReader?: (name: string) => string | undefined
  },
): Promise<SurveillanceFitnessPostResult> {
  const { url, key } = readSurveillanceFitnessWebhookConfig(options?.envReader ?? readProcessEnv)
  if (!url || !key) {
    return { ok: false, configured: false }
  }

  const body = buildSurveillanceFitnessWebhookBody(payload)
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as FetchLike)

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
    })
    return { ok: response.ok, configured: true, status: response.status }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : 'unknown',
    }
  }
}

export function daysSince(timestampMs: number, nowMs: number): number {
  const delta = Math.max(0, nowMs - timestampMs)
  return Math.floor(delta / (24 * 60 * 60 * 1000))
}

export function toIsoUtcZ(ms: number): string {
  return new Date(ms).toISOString()
}
