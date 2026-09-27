import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
  })

  it('uses Convex action path when convex-primary is active', async () => {
    isConvexDomainActive.mockReturnValue(true)
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
    isConvexDomainActive.mockReturnValue(true)
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
    isConvexDomainActive.mockReturnValue(true)
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
    isConvexDomainActive.mockReturnValue(true)
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

  it('keeps the Supabase edge-function path when convex-primary is disabled', async () => {
    isConvexDomainActive.mockReturnValue(false)
    compressMealImage.mockResolvedValue({
      base64: 'a'.repeat(1200),
      mimeType: 'image/jpeg',
    })
    const invoke = vi.fn().mockResolvedValue({
      data: {
        calories: 480,
        proteines: 26,
        glucides: 52,
        lipides: 14,
        scanCount: 1,
        dailyLimit: 5,
        scansRemaining: 4,
      },
      error: null,
    })
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'supabase-token' } },
        }),
      },
      functions: {
        invoke,
      },
    })

    const { analyzeMealPhoto } = await import('./mealPhotoAi')
    const result = await analyzeMealPhoto(new Blob(['fake'], { type: 'image/jpeg' }))

    expect(invoke).toHaveBeenCalledWith('analyze-meal-photo', {
      body: {
        imageBase64: 'a'.repeat(1200),
        mimeType: 'image/jpeg',
      },
    })
    expect(convexAction).not.toHaveBeenCalled()
    expect(result.scansRemaining).toBe(4)
  })
})
