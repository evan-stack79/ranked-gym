import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const isConvexDomainActive = vi.fn()
const getConvexSessionToken = vi.fn()
const compressMealImage = vi.fn()
const convexAction = vi.fn()
const getConvex = vi.fn(() => ({ action: convexAction, query: vi.fn() }))
const isSupabaseConfigured = vi.fn()
const getSupabase = vi.fn()
const safeError = vi.fn()

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive,
}))

vi.mock('./convexAuthService', () => ({
  getConvexSessionToken,
}))

vi.mock('../utils/compressMealImage', () => ({
  compressMealImage,
}))

vi.mock('../lib/convex', () => ({
  getConvex,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured,
  getSupabase,
}))

vi.mock('../utils/safeLog', () => ({
  safeError,
}))

describe('mealPhotoAi service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isConvexDomainActive.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(true)
  })

  it('V3-10 : source client n’appelle plus l’Edge Supabase analyze-meal-photo', () => {
    const source = readFileSync(new URL('./mealPhotoAi.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/functions\.invoke\(\s*['"]analyze-meal-photo['"]/)
    expect(source).not.toContain('FunctionsHttpError')
    expect(source).toContain('api.mealPhotoAi.analyzeMealPhoto')
  })

  it('uses Convex action path when convex-primary is active', async () => {
    getConvexSessionToken.mockResolvedValue('convex-session-token')
    compressMealImage.mockResolvedValue({
      base64: 'a'.repeat(1200),
      mimeType: 'image/jpeg',
    })
    convexAction.mockResolvedValue({
      ok: true,
      calories: 530,
      proteines: 31,
      glucides: 44,
      lipides: 19,
      scanCount: 2,
      dailyLimit: 5,
      scansRemaining: 3,
    })

    const { analyzeMealPhoto } = await import('./mealPhotoAi')
    const result = await analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))

    expect(getConvexSessionToken).toHaveBeenCalledTimes(1)
    expect(convexAction).toHaveBeenCalledTimes(1)
    expect(getSupabase).not.toHaveBeenCalled()
    expect(result).toEqual({
      calories: 530,
      proteines: 31,
      glucides: 44,
      lipides: 19,
      scanCount: 2,
      dailyLimit: 5,
      scansRemaining: 3,
    })
  })

  it('blocks convex path when the compressed payload is too large', async () => {
    getConvexSessionToken.mockResolvedValue('convex-session-token')
    compressMealImage.mockResolvedValue({
      base64: 'x'.repeat(900_001),
      mimeType: 'image/jpeg',
    })

    const { analyzeMealPhoto, MealPhotoAiError } = await import('./mealPhotoAi')
    const attempt = analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))
    await expect(attempt).rejects.toBeInstanceOf(MealPhotoAiError)
    await expect(attempt).rejects.toThrow('Photo trop volumineuse')
    expect(convexAction).not.toHaveBeenCalled()
  })

  it('surfaces Convex action business errors with french messages', async () => {
    getConvexSessionToken.mockResolvedValue('convex-session-token')
    compressMealImage.mockResolvedValue({
      base64: 'a'.repeat(1200),
      mimeType: 'image/jpeg',
    })
    convexAction.mockResolvedValue({
      ok: false,
      code: 'DAILY_LIMIT',
      error: 'Limite atteinte : 5 analyses photo / jour.',
      scansRemaining: 0,
      scanCount: 5,
      dailyLimit: 5,
    })

    const { analyzeMealPhoto, MealPhotoAiError } = await import('./mealPhotoAi')
    let thrown: unknown
    try {
      await analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(MealPhotoAiError)
    expect((thrown as Error).message).toContain('Limite atteinte')
    expect((thrown as { scansRemaining?: number }).scansRemaining).toBe(0)
  })

  it('uses dedicated overload FR message for convex ai_unavailable errors', async () => {
    getConvexSessionToken.mockResolvedValue('convex-session-token')
    compressMealImage.mockResolvedValue({
      base64: 'a'.repeat(1200),
      mimeType: 'image/jpeg',
    })
    convexAction.mockResolvedValue({
      ok: false,
      code: 'ai_unavailable',
      error: 'technical 503 from upstream',
      scansRemaining: 4,
      scanCount: 1,
      dailyLimit: 5,
    })

    const { analyzeMealPhoto, MealPhotoAiError } = await import('./mealPhotoAi')
    let thrown: unknown
    try {
      await analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(MealPhotoAiError)
    expect((thrown as Error).message).toMatch(
      /IA surchargée, réessaie dans un instant ; le quota n’est pas consommé\./,
    )
  })

  it('V3-10 : refuse le chemin Supabase — Convex requis', async () => {
    isConvexDomainActive.mockReturnValue(false)
    const { analyzeMealPhoto, MealPhotoAiError } = await import('./mealPhotoAi')
    await expect(analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))).rejects.toBeInstanceOf(
      MealPhotoAiError,
    )
    await expect(analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))).rejects.toThrow(
      /Analyse photo indisponible/,
    )
    expect(getSupabase).not.toHaveBeenCalled()
    expect(convexAction).not.toHaveBeenCalled()
  })
})
