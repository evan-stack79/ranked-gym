import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestPasswordReset = vi.fn()

vi.mock('../backend/authFeatureFlag', () => ({
  getActiveAuthBackend: () => 'convex',
}))

vi.mock('./convexAuthService', () => ({
  requestPasswordReset,
}))

describe('authService.requestPasswordReset (convex)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('propagates manual delivery state when email provider is unavailable', async () => {
    requestPasswordReset.mockResolvedValue({ accepted: true, delivery: 'manual' })
    const { requestPasswordReset: call } = await import('./authService')
    const result = await call('athlete@example.com', 'https://app.example.com/')
    expect(result).toEqual({ accepted: true, delivery: 'manual' })
  })

  it('propagates email delivery state when provider is configured', async () => {
    requestPasswordReset.mockResolvedValue({ accepted: true, delivery: 'email' })
    const { requestPasswordReset: call } = await import('./authService')
    const result = await call('athlete@example.com')
    expect(result).toEqual({ accepted: true, delivery: 'email' })
  })
})
