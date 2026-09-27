import { beforeEach, describe, expect, it, vi } from 'vitest'

const isConvexDomainActive = vi.fn()

vi.mock('./adapter', () => ({
  isConvexDomainActive,
}))

describe('runWithDomainBackend', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('uses supabase path when convex domain is not active', async () => {
    isConvexDomainActive.mockReturnValue(false)
    const { runWithDomainBackend } = await import('./domainBackend')
    const value = await runWithDomainBackend({
      operation: 'test.route',
      convex: async () => 'convex',
      supabase: async () => 'supabase',
    })
    expect(value).toBe('supabase')
  })

  it('uses convex path when active and healthy', async () => {
    isConvexDomainActive.mockReturnValue(true)
    const { runWithDomainBackend } = await import('./domainBackend')
    const value = await runWithDomainBackend({
      operation: 'test.route',
      convex: async () => 'convex-ok',
      supabase: async () => 'supabase',
    })
    expect(value).toBe('convex-ok')
  })

  it('throws a french service error when convex fails in convex-primary mode', async () => {
    isConvexDomainActive.mockReturnValue(true)
    const { runWithDomainBackend } = await import('./domainBackend')
    await expect(
      runWithDomainBackend({
        operation: 'test.route',
        convex: async () => {
          throw new Error('convex outage')
        },
        supabase: async () => 'supabase-fallback',
      }),
    ).rejects.toThrow(/service/i)
  })
})
