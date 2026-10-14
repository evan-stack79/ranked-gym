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

describe('accountLinkService — B8', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isConvexConfigured.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(true)
    getConvexSessionToken.mockResolvedValue('convex-session')
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
    })
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
    const args = query.mock.calls[0][1] as Record<string, unknown>
    expect(args).not.toHaveProperty('ownerUserId')
  })

  it('link : envoie seulement le token', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })
    getConvex.mockReturnValue({ action })
    const { linkLegacySupabaseAccountWithAccessToken } = await import('./accountLinkService')
    await linkLegacySupabaseAccountWithAccessToken('access-token-xyz')
    const args = action.mock.calls[0][1] as Record<string, unknown>
    expect(args).toEqual({
      sessionToken: 'convex-session',
      supabaseAccessToken: 'access-token-xyz',
    })
    expect(args).not.toHaveProperty('supabaseUserId')
    expect(args).not.toHaveProperty('email')
  })

  it('B8-02 : emails mismatch → Impossible de relier…', async () => {
    const action = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_EMAIL_MISMATCH'))
    getConvex.mockReturnValue({ action })
    const {
      linkLegacySupabaseAccountWithAccessToken,
      ERASE_MEALS_LINK_REFUSED_MESSAGE,
    } = await import('./accountLinkService')
    await expect(linkLegacySupabaseAccountWithAccessToken('token')).rejects.toThrow(
      ERASE_MEALS_LINK_REFUSED_MESSAGE,
    )
  })

  it('B8-02 : email non confirmé → Impossible de relier…', async () => {
    const action = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_EMAIL_UNCONFIRMED'))
    getConvex.mockReturnValue({ action })
    const {
      linkLegacySupabaseAccountWithAccessToken,
      ERASE_MEALS_LINK_REFUSED_MESSAGE,
    } = await import('./accountLinkService')
    await expect(linkLegacySupabaseAccountWithAccessToken('token')).rejects.toThrow(
      ERASE_MEALS_LINK_REFUSED_MESSAGE,
    )
  })

  it('B8-01 : assert link avec session téléphone B → purge error', async () => {
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'token-of-B' } },
          error: null,
        }),
      },
    })
    const action = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_MISMATCH'))
    getConvex.mockReturnValue({ action })
    const { requireAccountLinkForErase } = await import('./accountLinkService')
    const { ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./purgeSupabaseMealCopies')
    await expect(requireAccountLinkForErase()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(action).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionToken: 'convex-session',
        supabaseAccessToken: 'token-of-B',
      }),
    )
  })

  it('sans lien → reconnect message', async () => {
    const action = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_MISSING'))
    getConvex.mockReturnValue({ action })
    const {
      requireAccountLinkForErase,
      ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
    } = await import('./accountLinkService')
    await expect(requireAccountLinkForErase()).rejects.toThrow(
      ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
    )
  })
})
