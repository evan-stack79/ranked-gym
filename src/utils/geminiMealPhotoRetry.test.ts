import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_ERROR_FR,
  AI_UNAVAILABLE_FR,
  classifyGeminiError,
  clientFacingFromGeminiError,
  clientFacingGeminiFailure,
  computeBackoffMs,
  GeminiModelsExhaustedError,
  GeminiRetryBudgetExceededError,
  looksLikeTechnicalAiError,
  runGeminiWithRetryFallback,
  sanitizeMealPhotoAiClientMessage,
  uniqueModelCandidates,
} from './geminiMealPhotoRetry'

describe('classifyGeminiError', () => {
  it('classe 503 / high demand / overloaded en retryable', () => {
    expect(
      classifyGeminiError(
        new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [503 Service Unavailable] The model is overloaded. Please try again later.'),
      ),
    ).toBe('retryable')
    expect(classifyGeminiError('503 high demand')).toBe('retryable')
    expect(classifyGeminiError(new Error('UNAVAILABLE: resource exhausted'))).toBe('retryable')
  })

  it('classe 429 / rate limit en retryable', () => {
    expect(classifyGeminiError(new Error('429 Too Many Requests'))).toBe('retryable')
    expect(classifyGeminiError('rate limit exceeded')).toBe('retryable')
  })

  it('classe 500/502/504 et timeouts / réseau en retryable', () => {
    expect(classifyGeminiError(new Error('500 INTERNAL'))).toBe('retryable')
    expect(classifyGeminiError(new Error('502 Bad Gateway'))).toBe('retryable')
    expect(classifyGeminiError(new Error('504 Gateway Timeout'))).toBe('retryable')
    expect(classifyGeminiError(new Error('fetch failed'))).toBe('retryable')
    expect(classifyGeminiError(new Error('ETIMEDOUT'))).toBe('retryable')
  })

  it('classe 404 modèle en model_not_found (fallback)', () => {
    expect(
      classifyGeminiError(
        new Error('404 Not Found models/gemini-3.6-flash is not found for API version'),
      ),
    ).toBe('model_not_found')
  })

  it('classe clé invalide / 401 / 403 / 400 en fatal', () => {
    expect(classifyGeminiError(new Error('API_KEY_INVALID: API key not valid'))).toBe('fatal')
    expect(classifyGeminiError(new Error('401 UNAUTHENTICATED'))).toBe('fatal')
    expect(classifyGeminiError(new Error('PERMISSION_DENIED 403'))).toBe('fatal')
    expect(classifyGeminiError(new Error('400 INVALID_ARGUMENT: Bad Request'))).toBe('fatal')
  })
})

describe('uniqueModelCandidates', () => {
  it('déduplique sans changer l’ordre', () => {
    expect(uniqueModelCandidates(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })
})

describe('computeBackoffMs', () => {
  it('applique un jitter déterministe', () => {
    expect(computeBackoffMs(1000, () => 0)).toBe(850)
    expect(computeBackoffMs(1000, () => 1 - Number.EPSILON)).toBe(1150)
  })
})

describe('clientFacingGeminiFailure / messages FR', () => {
  it('ne fuit jamais d’URL, modèle ou texte technique', () => {
    const unavailable = clientFacingGeminiFailure('unavailable')
    const fatal = clientFacingFromGeminiError(new Error('API_KEY_INVALID AIzaSySECRET'))
    const overload = clientFacingFromGeminiError(
      new Error('[503] https://generativelanguage.googleapis.com models/gemini-3.6-flash'),
    )

    for (const facing of [unavailable, fatal, overload]) {
      expect(facing.error).not.toMatch(/https?:\/\//i)
      expect(facing.error).not.toMatch(/gemini/i)
      expect(facing.error).not.toMatch(/AIza|API_KEY|GoogleGenerativeAI/i)
      expect(facing.error).toMatch(/Analyse/)
    }
    expect(unavailable.error).toBe(AI_UNAVAILABLE_FR)
    expect(overload.code).toBe('ai_unavailable')
    expect(fatal.code).toBe('ai_error')
    expect(fatal.error).toBe(AI_ERROR_FR)
  })
})

describe('looksLikeTechnicalAiError + sanitizeMealPhotoAiClientMessage (filet client)', () => {
  it('détecte fuites techniques Google / HTTP', () => {
    expect(
      looksLikeTechnicalAiError(
        '[GoogleGenerativeAI Error]: https://generativelanguage.googleapis.com [503 Service Unavailable]',
      ),
    ).toBe(true)
    expect(looksLikeTechnicalAiError('Service Unavailable')).toBe(true)
    expect(looksLikeTechnicalAiError('Clé Gemini invalide — aistudio.google.com/apikey')).toBe(true)
  })

  it('garde les messages métier FR (quota, empty macros)', () => {
    const quota = 'Limite atteinte : 5 analyses photo / jour.'
    expect(
      sanitizeMealPhotoAiClientMessage(quota, { code: 'DAILY_LIMIT', httpStatus: 429 }),
    ).toBe(quota)
    expect(
      sanitizeMealPhotoAiClientMessage(quota, { httpStatus: 429 }),
    ).toBe(quota)

    const empty =
      'Impossible d’estimer le repas — reprends la photo (repas visible, bon éclairage).'
    expect(sanitizeMealPhotoAiClientMessage(empty, { code: 'EMPTY_MACROS' })).toBe(empty)
  })

  it('remplace message technique ou status >= 500 par FR générique', () => {
    expect(
      sanitizeMealPhotoAiClientMessage(
        '[GoogleGenerativeAI Error]: [503 Service Unavailable] high demand',
        { httpStatus: 502 },
      ),
    ).toBe(AI_UNAVAILABLE_FR)

    expect(
      sanitizeMealPhotoAiClientMessage('Serveur ok métier', { httpStatus: 503 }),
    ).toBe(AI_UNAVAILABLE_FR)

    expect(
      sanitizeMealPhotoAiClientMessage('anything', { code: 'ai_unavailable' }),
    ).toBe(AI_UNAVAILABLE_FR)
  })
})

describe('runGeminiWithRetryFallback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('réussit au premier essai sans sleep', async () => {
    const sleep = vi.fn(async () => {})
    const attempt = vi.fn(async () => 'ok')

    const out = await runGeminiWithRetryFallback({
      models: ['m1', 'm2'],
      attempt,
      deps: { now: () => 0, sleep, random: () => 0.5 },
    })

    expect(out).toEqual({ result: 'ok', modelUsed: 'm1' })
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('sur 503 : 2 retries même modèle avec backoff, puis succès', async () => {
    const sleep = vi.fn(async () => {})
    let n = 0
    const attempt = vi.fn(async () => {
      n += 1
      if (n < 3) throw new Error('[503 Service Unavailable] high demand')
      return 'ok'
    })

    const out = await runGeminiWithRetryFallback({
      models: ['gemini-a'],
      attempt,
      backoffMs: [700, 1500],
      deps: { now: () => 0, sleep, random: () => 0.5 },
    })

    expect(out.modelUsed).toBe('gemini-a')
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, computeBackoffMs(700, () => 0.5))
    expect(sleep).toHaveBeenNthCalledWith(2, computeBackoffMs(1500, () => 0.5))
  })

  it('après retries 503 épuisés : bascule au modèle suivant (sans dupliquer)', async () => {
    const sleep = vi.fn(async () => {})
    const calls: string[] = []
    const attempt = vi.fn(async (model: string) => {
      calls.push(model)
      if (model === 'm1') throw new Error('503 Service Unavailable')
      return `from-${model}`
    })

    const out = await runGeminiWithRetryFallback({
      models: ['m1', 'm1', 'm2'],
      attempt,
      backoffMs: [10, 20],
      maxExtraAttemptsPerModel: 2,
      deps: { now: () => 0, sleep, random: () => 0 },
    })

    expect(out).toEqual({ result: 'from-m2', modelUsed: 'm2' })
    // m1: 1 + 2 retries = 3, puis m2: 1
    expect(calls.filter((c) => c === 'm1')).toHaveLength(3)
    expect(calls.filter((c) => c === 'm2')).toHaveLength(1)
  })

  it('sur 404 modèle : pas de retry, bascule immédiate', async () => {
    const sleep = vi.fn(async () => {})
    const calls: string[] = []
    const attempt = vi.fn(async (model: string) => {
      calls.push(model)
      if (model === 'gone') {
        throw new Error('404 Not Found models/gone is not found for API version')
      }
      return 'ok'
    })

    const out = await runGeminiWithRetryFallback({
      models: ['gone', 'alive'],
      attempt,
      deps: { now: () => 0, sleep, random: () => 0 },
    })

    expect(out.modelUsed).toBe('alive')
    expect(calls).toEqual(['gone', 'alive'])
    expect(sleep).not.toHaveBeenCalled()
  })

  it('sur erreur fatale (clé) : stop immédiat sans fallback modèle', async () => {
    const sleep = vi.fn(async () => {})
    const attempt = vi.fn(async () => {
      throw new Error('API_KEY_INVALID: API key not valid')
    })

    await expect(
      runGeminiWithRetryFallback({
        models: ['m1', 'm2'],
        attempt,
        deps: { now: () => 0, sleep, random: () => 0 },
      }),
    ).rejects.toThrow(/API_KEY_INVALID/)

    expect(attempt).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('respecte le budget temps total (~18s) et s’arrête proprement', async () => {
    let fakeNow = 0
    const sleep = vi.fn(async (ms: number) => {
      fakeNow += ms
    })
    const attempt = vi.fn(async () => {
      fakeNow += 5_000
      throw new Error('503 Service Unavailable')
    })

    await expect(
      runGeminiWithRetryFallback({
        models: ['m1', 'm2', 'm3'],
        attempt,
        backoffMs: [700, 1500],
        budgetMs: 18_000,
        deps: {
          now: () => fakeNow,
          sleep,
          random: () => 0,
        },
      }),
    ).rejects.toBeInstanceOf(GeminiRetryBudgetExceededError)

    expect(fakeNow).toBeLessThanOrEqual(18_000 + 5_000) // dernière tentative peut démarrer juste sous le budget
    expect(attempt.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(attempt.mock.calls.length).toBeLessThan(9) // pas de boucle infinie sur 3 modèles × 3
  })

  it('si tous les modèles échouent en retryable : GeminiModelsExhaustedError', async () => {
    const sleep = vi.fn(async () => {})
    const attempt = vi.fn(async () => {
      throw new Error('503 overloaded')
    })

    await expect(
      runGeminiWithRetryFallback({
        models: ['a', 'b'],
        attempt,
        backoffMs: [1, 1],
        maxExtraAttemptsPerModel: 1,
        deps: { now: () => 0, sleep, random: () => 0 },
      }),
    ).rejects.toBeInstanceOf(GeminiModelsExhaustedError)
  })
})
