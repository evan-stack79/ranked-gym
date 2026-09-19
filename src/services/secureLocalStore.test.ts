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

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => 'athlete-1'),
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
  vi.stubGlobal('window', {
    location: { origin: 'https://ranked-gym.test' },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('secureLocalStore encrypted blobs', () => {
  beforeEach(async () => {
    store.clear()
    nativeKv.clear()
    nativeOn.value = false
    installLocalStorage()
    const local = await import('./secureLocalStore')
    local.resetSecureLocalStoreForTests()
  })

  afterEach(async () => {
    const local = await import('./secureLocalStore')
    local.resetSecureLocalStoreForTests()
    vi.unstubAllGlobals()
  })

  it('migrates plaintext health blobs to ciphertext and still hydrates APIs', async () => {
    nativeOn.value = true
    const sleep = await import('./sleepStorage')
    const nutrition = await import('./nutritionStorage')
    const lobby = await import('./lobbyStorage')
    const local = await import('./secureLocalStore')

    sleep.saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 7, dateKey: '2026-09-12' },
      { skipCloud: true },
    )
    nutrition.saveCalorieProfile(
      {
        weightKg: 81,
        goalWeightKg: 78,
        heightCm: 178,
        age: 29,
        sex: 'male',
        activity: 'moderate',
        morphology: 'mesomorph',
        goal: 'cut',
        weeklyPaceKg: 0.5,
        onboardingComplete: true,
      },
      { skipCloud: true },
    )
    lobby.saveLastLocationLabel('Salle Test', 'gps', { lat: 48.8566, lng: 2.3522 }, { skipCloud: true })

    expect(store.get('ranked-gym:sleep-log:u:athlete-1') ?? '').toContain('23:00')
    expect(store.get('ranked-gym:nutrition-profile:u:athlete-1') ?? '').toContain('"weightKg":81')
    expect(store.get('ranked-gym:last-location:u:athlete-1') ?? '').toContain('48.8566')

    await local.initSecureLocalStore()
    await local.flushSecureLocalStore()

    expect(nativeKv.get('ranked-gym-wrap-key')).toBeTruthy()
    expect(store.has('ranked-gym-device-secret')).toBe(false)

    const sleepRaw = store.get('ranked-gym:sleep-log:u:athlete-1') ?? ''
    const profileRaw = store.get('ranked-gym:nutrition-profile:u:athlete-1') ?? ''
    const locationRaw = store.get('ranked-gym:last-location:u:athlete-1') ?? ''
    expect(sleepRaw).not.toContain('23:00')
    expect(sleepRaw).not.toContain('tstHours')
    expect(profileRaw).not.toContain('weightKg')
    expect(profileRaw).not.toContain('goalWeightKg')
    expect(profileRaw.startsWith('{')).toBe(false)
    expect(locationRaw).not.toContain('48.8566')
    expect(locationRaw).not.toContain('Salle Test')

    expect(sleep.getLatestSleepNight()?.bedtime).toBe('23:00')
    expect(nutrition.getCalorieProfile().weightKg).toBe(81)
    expect(lobby.getLastLocationLabel()?.lat).toBe(48.8566)
  })

  it('keeps skipCloud hydrate working through encrypted local reads', async () => {
    nativeOn.value = true
    const local = await import('./secureLocalStore')
    const sleep = await import('./sleepStorage')

    await local.initSecureLocalStore()
    sleep.replaceSleepLog(
      [
        {
          id: 'sleep-2026-09-11',
          dateKey: '2026-09-11',
          bedtime: '22:30',
          waketime: '06:30',
          tstHours: 7,
          createdAt: '2026-09-11T06:30:00.000Z',
        },
      ],
      { skipCloud: true },
    )
    await local.flushSecureLocalStore()

    expect(sleep.getLatestSleepNight()?.bedtime).toBe('22:30')
    expect(sleep.getSleepLog()).toHaveLength(1)
    expect(store.get('ranked-gym:sleep-log:u:athlete-1') ?? '').not.toContain('22:30')
  })

  it('encrypts a large training blob quickly', async () => {
    nativeOn.value = true
    const local = await import('./secureLocalStore')
    await local.initSecureLocalStore()

    const bulky = JSON.stringify({
      notes: Array.from({ length: 80 }, (_, i) => ({
        id: `note-${i}`,
        title: `Séance ${i}`,
        exercises: [{ name: 'Squat', sets: [{ reps: 8, weightKg: 100 + i }] }],
      })),
    })
    const started = performance.now()
    local.writeLocal('ranked-gym:training:u:athlete-1', bulky)
    await local.flushSecureLocalStore()
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(250)
    expect(store.get('ranked-gym:training:u:athlete-1') ?? '').not.toContain('Squat')
    expect(local.readLocal('ranked-gym:training:u:athlete-1')).toBe(bulky)
  })
})
