/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getConvex = vi.fn()
const getConvexSessionToken = vi.fn()
const getSupabase = vi.fn()
const isConvexConfigured = vi.fn(() => true)
const isSupabaseConfigured = vi.fn(() => true)

vi.mock('../lib/convex', () => ({
  isConvexConfigured: () => isConvexConfigured(),
  getConvex: () => getConvex(),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  getSupabase: () => getSupabase(),
}))

vi.mock('./convexAuthService', () => ({
  getConvexSessionToken: () => getConvexSessionToken(),
}))

describe('accountLinkService — B7', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isConvexConfigured.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(true)
    getConvexSessionToken.mockResolvedValue('convex-session')
  })

  it('fetchMyAccountLink : session only — pas d’ownerUserId client', async () => {
    const query = vi.fn().mockResolvedValue({
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
      linkedAt: 1,
    })
    getConvex.mockReturnValue({ query })
    const { fetchMyAccountLink } = await import('./accountLinkService')
    const link = await fetchMyAccountLink()
    expect(link?.supabaseUserId).toBe('supabase-A')
    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      { sessionToken: 'convex-session' },
    )
    const args = query.mock.calls[0][1] as Record<string, unknown>
    expect(args).not.toHaveProperty('ownerUserId')
  })

  it('linkLegacySupabaseAccountWithAccessToken : envoie seulement le token', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })
    getConvex.mockReturnValue({ action })
    const { linkLegacySupabaseAccountWithAccessToken } = await import('./accountLinkService')
    await linkLegacySupabaseAccountWithAccessToken('access-token-xyz')
    expect(action).toHaveBeenCalledWith(
      expect.anything(),
      {
        sessionToken: 'convex-session',
        supabaseAccessToken: 'access-token-xyz',
      },
    )
    const args = action.mock.calls[0][1] as Record<string, unknown>
    expect(args).not.toHaveProperty('supabaseUserId')
  })

  it('token refusé serveur → erreur, pas de lien local inventé', async () => {
    const action = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_SUPABASE_UNRESOLVED'))
    getConvex.mockReturnValue({ action })
    const { linkLegacySupabaseAccountWithAccessToken } = await import('./accountLinkService')
    const { ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./purgeSupabaseMealCopies')
    await expect(linkLegacySupabaseAccountWithAccessToken('fake')).rejects.toThrow(
      ERASE_MEALS_PURGE_FAILED_MESSAGE,
    )
  })

  it('requireAccountLinkForErase sans lien → reconnect message', async () => {
    const query = vi.fn().mockResolvedValue(null)
    getConvex.mockReturnValue({ query })
    const {
      requireAccountLinkForErase,
      ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
    } = await import('./accountLinkService')
    await expect(requireAccountLinkForErase()).rejects.toThrow(
      ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
    )
  })
})
