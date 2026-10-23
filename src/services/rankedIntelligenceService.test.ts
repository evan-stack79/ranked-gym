import { beforeEach, describe, expect, it, vi } from 'vitest'

const getConvexSessionToken = vi.fn()
const convexAction = vi.fn()
const getConvex = vi.fn(() => ({ action: convexAction }))
const isConvexConfigured = vi.fn()

vi.mock('./convexAuthService', () => ({
  getConvexSessionToken: () => getConvexSessionToken(),
}))

vi.mock('../lib/convex', () => ({
  getConvex: () => getConvex(),
  isConvexConfigured: () => isConvexConfigured(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { ai: { askRankedIntelligence: 'ai.askRankedIntelligence' } },
}))

import { askRankedIntelligence } from './rankedIntelligenceService'

describe('askRankedIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isConvexConfigured.mockReturnValue(true)
    getConvexSessionToken.mockResolvedValue('session-token')
  })

  it('refuse sans Convex configuré', async () => {
    isConvexConfigured.mockReturnValue(false)
    const result = await askRankedIntelligence()
    expect(result).toEqual({
      ok: false,
      error: 'Convex non configuré — impossible d’appeler le coach IA.',
      code: 'CONVEX_NOT_CONFIGURED',
    })
    expect(convexAction).not.toHaveBeenCalled()
  })

  it('refuse sans session', async () => {
    getConvexSessionToken.mockResolvedValue(null)
    const result = await askRankedIntelligence()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('AUTH_REQUIRED')
  })

  it('passe sessionToken (pas userId) et lit message', async () => {
    convexAction.mockResolvedValue({
      ok: true,
      source: 'ai',
      message: 'Bosse le squat.',
      aiCallsToday: 1,
      dailyLimit: 3,
      remaining: 2,
      leanMassKg: 68,
      ffmi: 21,
    })

    const result = await askRankedIntelligence('Que bosser ?')
    expect(convexAction).toHaveBeenCalledWith('ai.askRankedIntelligence', {
      sessionToken: 'session-token',
      question: 'Que bosser ?',
    })
    expect(result).toMatchObject({ ok: true, message: 'Bosse le squat.' })
  })
})
