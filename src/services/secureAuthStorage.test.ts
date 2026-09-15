import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nativeOn = vi.hoisted(() => ({ value: false }))
const nativeKv = vi.hoisted(() => new Map<string, string>())

vi.mock('../native/secureStorage', () => ({
  isNativeSecureStorageAvailable: () => nativeOn.value,
  bindSecureStoragePlugin: async () => {},
  SecureStorage: {
    get: async ({ key }: { key: string }) => ({ value: nativeKv.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      nativeKv.set(key, value)
    },
    remove: async ({ key }: { key: string }) => {
      nativeKv.delete(key)
    },
  },
}))

const store = new Map<string, string>()

function installLocalStorage() {
  const api: Storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  vi.stubGlobal('localStorage', api)
}

const SESSION = JSON.stringify({
  access_token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdGhsZXRlLTEiLCJleHAiOjk5OTk5OTk5OTl9.signature',
  refresh_token: 'refresh-secret-do-not-leak',
  expires_at: 9999999999,
})

function localDump(): string {
  return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('\n')
}

describe('secureAuthStorage', () => {
  beforeEach(async () => {
    store.clear()
    nativeKv.clear()
    nativeOn.value = false
    installLocalStorage()
    const auth = await import('./secureAuthStorage')
    auth.resetSecureAuthStorageForTests()
  })

  afterEach(async () => {
    const auth = await import('./secureAuthStorage')
    auth.resetSecureAuthStorageForTests()
    vi.unstubAllGlobals()
  })

  it('web path never writes a clear JWT; wrap secret remains the documented residual', async () => {
    const {
      AUTH_STORAGE_KEY,
      clearSecureAuthStorage,
      getSecureAuthStorage,
      initSecureAuthStorage,
    } = await import('./secureAuthStorage')

    await initSecureAuthStorage()
    const storage = getSecureAuthStorage()
    await Promise.resolve(storage.setItem(AUTH_STORAGE_KEY, SESSION))

    const dumped = localDump()
    expect(dumped).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(dumped).not.toContain('refresh-secret-do-not-leak')
    expect(store.get('ranked-gym-device-secret')).toBeTruthy()
    expect(looksLikeJsonPayload(store.get(AUTH_STORAGE_KEY) ?? '')).toBe(false)

    const roundTrip = await Promise.resolve(storage.getItem(AUTH_STORAGE_KEY))
    expect(roundTrip).toBe(SESSION)

    await clearSecureAuthStorage()
    expect(await Promise.resolve(storage.getItem(AUTH_STORAGE_KEY))).toBeNull()
    expect(store.get(AUTH_STORAGE_KEY)).toBeUndefined()
  })

  it('native path keeps tokens in the plugin and strips WebView localStorage residues', async () => {
    nativeOn.value = true
    const {
      AUTH_STORAGE_KEY,
      CONVEX_AUTH_STORAGE_KEY,
      clearSecureAuthStorage,
      collectCleartextAuthResidueKeys,
      getSecureAuthStorage,
      initSecureAuthStorage,
    } = await import('./secureAuthStorage')

    store.set(AUTH_STORAGE_KEY, SESSION)
    store.set('ranked-gym-device-secret', 'legacy-device-secret')
    store.set('sb-abc123xyz-auth-token', SESSION)

    await initSecureAuthStorage()
    const storage = getSecureAuthStorage()

    expect(nativeKv.get(AUTH_STORAGE_KEY)).toBe(SESSION)
    expect(store.has(AUTH_STORAGE_KEY)).toBe(false)
    expect(store.has('ranked-gym-device-secret')).toBe(false)
    expect(store.has('sb-abc123xyz-auth-token')).toBe(false)
    expect(collectCleartextAuthResidueKeys()).toEqual([])
    expect(localDump()).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(localDump()).not.toContain('refresh-secret-do-not-leak')

    await Promise.resolve(storage.setItem(CONVEX_AUTH_STORAGE_KEY, 'convex-session-token'))
    expect(nativeKv.get(CONVEX_AUTH_STORAGE_KEY)).toBe('convex-session-token')
    expect(store.has(CONVEX_AUTH_STORAGE_KEY)).toBe(false)

    await clearSecureAuthStorage()
    expect(nativeKv.has(AUTH_STORAGE_KEY)).toBe(false)
    expect(nativeKv.has(CONVEX_AUTH_STORAGE_KEY)).toBe(false)
    expect(await Promise.resolve(storage.getItem(AUTH_STORAGE_KEY))).toBeNull()
  })
})

function looksLikeJsonPayload(raw: string): boolean {
  const trimmed = raw.trimStart()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}
