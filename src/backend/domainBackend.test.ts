import { beforeEach, describe, expect, it, vi } from 'vitest'

const isConvexDomainActive = vi.fn()
const isSupabaseConfigured = vi.fn()
const safeWarn = vi.fn()

vi.mock('./adapter', () => ({
  isConvexDomainActive,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured,
}))

vi.mock('../utils/safeLog', () => ({
  safeWarn,
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

  it('falls back to supabase when convex fails and fallback is available', async () => {
    isConvexDomainActive.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(true)
    const { runWithDomainBackend } = await import('./domainBackend')
    const value = await runWithDomainBackend({
      operation: 'test.route',
      convex: async () => {
        throw new Error('convex outage')
      },
      supabase: async () => 'supabase-fallback',
    })
    expect(value).toBe('supabase-fallback')
    expect(safeWarn).toHaveBeenCalled()
  })
})
