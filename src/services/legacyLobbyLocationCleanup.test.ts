import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('purgeLegacyLobbyLocationKeys', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    })
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes bare and per-user Lobby location keys on start cleanup', async () => {
    store.set('ranked-gym:check-in', '{"gymId":"g1"}')
    store.set('ranked-gym:check-in:u:user-a', '{"gymId":"g2"}')
    store.set('ranked-gym:custom-gyms', '[{"lat":48.8,"lng":2.3}]')
    store.set('ranked-gym:custom-gyms:u:user-b', '[]')
    store.set('ranked-gym:last-location', '{"label":"Paris","lat":48.8}')
    store.set('ranked-gym:last-location:u:user-a', '{"label":"Lyon"}')
    store.set('ranked-gym:training:u:user-a', '{"routines":[]}')
    store.set('unrelated-key', 'keep-me')

    const { purgeLegacyLobbyLocationKeys } = await import('./legacyLobbyLocationCleanup')
    const { removed } = purgeLegacyLobbyLocationKeys()

    expect(removed.sort()).toEqual(
      [
        'ranked-gym:check-in',
        'ranked-gym:check-in:u:user-a',
        'ranked-gym:custom-gyms',
        'ranked-gym:custom-gyms:u:user-b',
        'ranked-gym:last-location',
        'ranked-gym:last-location:u:user-a',
      ].sort(),
    )
    expect(store.has('ranked-gym:check-in')).toBe(false)
    expect(store.has('ranked-gym:check-in:u:user-a')).toBe(false)
    expect(store.has('ranked-gym:custom-gyms')).toBe(false)
    expect(store.has('ranked-gym:custom-gyms:u:user-b')).toBe(false)
    expect(store.has('ranked-gym:last-location')).toBe(false)
    expect(store.has('ranked-gym:last-location:u:user-a')).toBe(false)
    expect(store.get('ranked-gym:training:u:user-a')).toBe('{"routines":[]}')
    expect(store.get('unrelated-key')).toBe('keep-me')
  })
})
