/**
 * Logique pure : classification / retry / fallback Gemini pour le scan photo repas.
 *
 * Emplacement : `supabase/functions/_shared/` (convention bundler `supabase functions deploy`).
 * Consommateurs :
 * - Edge `analyze-meal-photo` (import `../_shared/...`)
 * - Front / Vitest via re-export `src/utils/geminiMealPhotoRetry.ts`
 *
 * Aucun import — compatible Deno 2 et Vite/Node (Vitest).
 */

export type GeminiErrorKind = 'retryable' | 'model_not_found' | 'fatal'

export type MealPhotoAiClientCode = 'ai_unavailable' | 'ai_error'

/** Surcharge / erreur transitoire après retries épuisés. */
export const AI_UNAVAILABLE_FR =
  'IA surchargée, réessaie dans un instant ; le quota n’est pas consommé.'

/** Erreur non retryable ou échec générique (jamais de détail technique). */
export const AI_ERROR_FR = 'Analyse impossible pour le moment — réessaie plus tard.'

/** Backoff entre tentatives sur le même modèle (ms), avant jitter. */
export const DEFAULT_RETRY_BACKOFF_MS = [700, 1500] as const

/** Budget total pour tous les essais (reste sous le timeout Edge ~150s, cible courte). */
export const DEFAULT_TOTAL_BUDGET_MS = 18_000

/** Nombre de nouvelles tentatives sur le même modèle après le 1er échec retryable. */
export const MAX_EXTRA_ATTEMPTS_PER_MODEL = 2

export type ClockDeps = {
  now: () => number
  sleep: (ms: number) => Promise<void>
  /** [0, 1) — jitter ; défaut Math.random */
  random: () => number
}

const defaultDeps: ClockDeps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Classifie une erreur Gemini / réseau pour décider retry vs fallback vs abort.
 *
 * Retryables : 503, 500/502/504, 429 (rate limit / overloaded Google), timeouts, réseau.
 * Model not found : 404 modèle → bascule modèle suivant (comportement historique).
 * Fatal : clé invalide / 401 / 403, requête/image invalide 400.
 */
export function classifyGeminiError(error: unknown): GeminiErrorKind {
  const message = errorText(error)

  // Clé / auth — avant les checks status génériques
  if (
    /API_KEY_INVALID|API key not valid|invalid api key|PERMISSION_DENIED|401|403|UNAUTHENTICATED|permission denied/i.test(
      message,
    )
  ) {
    return 'fatal'
  }

  // 404 modèle (garde le fallback existant) — exige un indice « models/ » ou NOT_FOUND modèle
  if (/404|not found|NOT_FOUND/i.test(message) && /models\//i.test(message)) {
    return 'model_not_found'
  }
  if (/is not found for API version|model .* not found|Publisher Model .* was not found/i.test(message)) {
    return 'model_not_found'
  }

  // Requête / image invalide
  if (/\b400\b|INVALID_ARGUMENT|invalid argument|Bad Request/i.test(message)) {
    return 'fatal'
  }

  // Surcharge / rate limit Google
  if (
    /\b503\b|UNAVAILABLE|high demand|overloaded|Service Unavailable|resource.?exhausted|\b429\b|Too Many Requests|rate.?limit/i.test(
      message,
    )
  ) {
    return 'retryable'
  }

  // Erreurs serveur Google
  if (/\b500\b|\b502\b|\b504\b|INTERNAL|DEADLINE_EXCEEDED|Gateway Timeout|Bad Gateway/i.test(message)) {
    return 'retryable'
  }

  // Timeouts / réseau
  if (
    /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network|fetch failed|Failed to fetch|socket hang up/i.test(
      message,
    )
  ) {
    return 'retryable'
  }

  // Par défaut : fatal (ne pas boucler indéfiniment sur erreurs inconnues)
  return 'fatal'
}

export function isRetryableGeminiError(error: unknown): boolean {
  return classifyGeminiError(error) === 'retryable'
}

export function isGeminiModelNotFoundError(error: unknown): boolean {
  return classifyGeminiError(error) === 'model_not_found'
}

/** Déduplique en préservant l’ordre (GEMINI_MODEL + fallbacks). */
export function uniqueModelCandidates(models: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of models) {
    const m = raw.trim()
    if (!m || seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out
}

/** Backoff avec petit jitter (±~15 %). */
export function computeBackoffMs(
  baseMs: number,
  random: () => number = Math.random,
): number {
  const jitterFactor = 0.85 + random() * 0.3
  return Math.max(0, Math.round(baseMs * jitterFactor))
}

export type ClientFacingFailure = {
  error: string
  code: MealPhotoAiClientCode
  /** HTTP status conseillé pour la réponse Edge. */
  httpStatus: number
}

/**
 * Message FR générique pour le client — jamais d’URL, nom de modèle, code Google, texte technique.
 */
export function clientFacingGeminiFailure(
  reason: 'unavailable' | 'error' = 'error',
): ClientFacingFailure {
  if (reason === 'unavailable') {
    return { error: AI_UNAVAILABLE_FR, code: 'ai_unavailable', httpStatus: 503 }
  }
  return { error: AI_ERROR_FR, code: 'ai_error', httpStatus: 502 }
}

/** Mappe l’erreur finale (après retries) vers un message client sûr. */
export function clientFacingFromGeminiError(error: unknown): ClientFacingFailure {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : ''
  if (code === 'ai_unavailable' || name === 'GeminiRetryBudgetExceededError') {
    return clientFacingGeminiFailure('unavailable')
  }
  const kind = classifyGeminiError(error)
  if (kind === 'retryable' || kind === 'model_not_found') {
    return clientFacingGeminiFailure('unavailable')
  }
  return clientFacingGeminiFailure('error')
}

/**
 * Détecte un message qui ressemble à une fuite technique Google / HTTP
 * (filet de sécurité côté client).
 */
export function looksLikeTechnicalAiError(message: string): boolean {
  const m = message.trim()
  if (!m) return true

  if (/https?:\/\//i.test(m)) return true
  if (/GoogleGenerativeAI|generativelanguage|googleapis\.com/i.test(m)) return true
  if (/\[\s*50[0-9]\s*\]|\b50[0-9]\s+Service|\bService Unavailable\b/i.test(m)) return true
  if (/\bUNAVAILABLE\b|\bRESOURCE_EXHAUSTED\b|\bINTERNAL\b|\bDEADLINE_EXCEEDED\b/i.test(m)) return true
  if (/API_KEY_INVALID|API key not valid|GEMINI_API_KEY|aistudio\.google/i.test(m)) return true
  if (/high demand|overloaded|Too Many Requests/i.test(m)) return true
  if (/Erreur Gemini|models\/gemini/i.test(m)) return true

  // Anglais technique courant renvoyé brut par le SDK
  if (
    /^(Error|Failed|Exception|TypeError|fetch failed)/i.test(m) ||
    /\bstatus(Text)?\b.+\b(503|429|500)\b/i.test(m)
  ) {
    return true
  }

  return false
}

/**
 * Filet client : remplace les fuites techniques / status >= 500, garde les messages métier FR.
 */
export function sanitizeMealPhotoAiClientMessage(
  message: string,
  opts?: { httpStatus?: number; code?: string },
): string {
  const code = opts?.code
  // Codes métier connus — ne pas écraser
  if (code === 'DAILY_LIMIT' || code === 'EMPTY_MACROS' || code === 'AUTH_REQUIRED') {
    return message
  }
  if (code === 'ai_unavailable') return AI_UNAVAILABLE_FR
  if (code === 'ai_error') return AI_ERROR_FR

  const status = opts?.httpStatus
  if (typeof status === 'number' && status >= 500) {
    return AI_UNAVAILABLE_FR
  }

  // Quota métier déjà en FR
  if (/limite atteinte/i.test(message) && /analyses photo/i.test(message)) {
    return message
  }

  if (looksLikeTechnicalAiError(message)) {
    return AI_UNAVAILABLE_FR
  }

  return message
}

export class GeminiRetryBudgetExceededError extends Error {
  readonly code = 'ai_unavailable' as const
  constructor(message = 'Gemini retry budget exceeded') {
    super(message)
    this.name = 'GeminiRetryBudgetExceededError'
  }
}

export class GeminiModelsExhaustedError extends Error {
  readonly lastError: unknown
  readonly code = 'ai_unavailable' as const
  constructor(lastError: unknown, models: readonly string[]) {
    super(
      `Tous les modèles Gemini ont échoué (${models.join(', ') || 'aucun'}).`,
    )
    this.name = 'GeminiModelsExhaustedError'
    this.lastError = lastError
  }
}

export type RunGeminiWithRetryOptions<T> = {
  models: readonly string[]
  /** Appel unique pour un modèle donné (mockable). */
  attempt: (modelName: string) => Promise<T>
  backoffMs?: readonly number[]
  budgetMs?: number
  maxExtraAttemptsPerModel?: number
  deps?: Partial<ClockDeps>
  /** Hook optionnel (tests / logs serveur). */
  onRetry?: (info: {
    modelName: string
    attemptIndex: number
    delayMs: number
    error: unknown
  }) => void
  onModelFallback?: (info: { fromModel: string; reason: GeminiErrorKind; error: unknown }) => void
}

/**
 * Pour chaque modèle : jusqu’à 1 + maxExtraAttempts tentatives sur erreur retryable
 * avec backoff, puis bascule au modèle suivant. Budget temps global borné.
 */
export async function runGeminiWithRetryFallback<T>(
  options: RunGeminiWithRetryOptions<T>,
): Promise<{ result: T; modelUsed: string }> {
  const models = uniqueModelCandidates(options.models)
  const backoffMs = options.backoffMs ?? DEFAULT_RETRY_BACKOFF_MS
  const budgetMs = options.budgetMs ?? DEFAULT_TOTAL_BUDGET_MS
  const maxExtra = options.maxExtraAttemptsPerModel ?? MAX_EXTRA_ATTEMPTS_PER_MODEL
  const deps: ClockDeps = { ...defaultDeps, ...options.deps }

  if (models.length === 0) {
    throw new GeminiModelsExhaustedError(new Error('Aucun modèle Gemini configuré'), models)
  }

  const startedAt = deps.now()
  let lastError: unknown = null

  for (const modelName of models) {
    let extraAttemptsUsed = 0

    while (true) {
      const elapsed = deps.now() - startedAt
      if (elapsed >= budgetMs) {
        throw new GeminiRetryBudgetExceededError(
          `Budget retry Gemini dépassé (${budgetMs} ms).`,
        )
      }

      try {
        const result = await options.attempt(modelName)
        return { result, modelUsed: modelName }
      } catch (error) {
        lastError = error
        const kind = classifyGeminiError(error)

        if (kind === 'fatal') {
          throw error
        }

        if (kind === 'model_not_found') {
          options.onModelFallback?.({ fromModel: modelName, reason: kind, error })
          break
        }

        // retryable
        if (extraAttemptsUsed < maxExtra && extraAttemptsUsed < backoffMs.length) {
          const remaining = budgetMs - (deps.now() - startedAt)
          if (remaining <= 0) {
            throw new GeminiRetryBudgetExceededError(
              `Budget retry Gemini dépassé (${budgetMs} ms).`,
            )
          }
          const base = backoffMs[extraAttemptsUsed] ?? backoffMs[backoffMs.length - 1]!
          const delay = Math.min(computeBackoffMs(base, deps.random), remaining)
          options.onRetry?.({
            modelName,
            attemptIndex: extraAttemptsUsed + 1,
            delayMs: delay,
            error,
          })
          await deps.sleep(delay)
          extraAttemptsUsed += 1
          continue
        }

        // Retries épuisés sur ce modèle → modèle suivant
        options.onModelFallback?.({ fromModel: modelName, reason: 'retryable', error })
        break
      }
    }
  }

  if (lastError instanceof GeminiRetryBudgetExceededError) throw lastError
  throw new GeminiModelsExhaustedError(lastError, models)
}
