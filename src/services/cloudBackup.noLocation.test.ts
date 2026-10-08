import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/adapter', () => ({
  isActiveCloudBackendConfigured: () => false,
  isConvexDomainActive: () => false,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('supabase unused')
  },
}))

const LOCATION_KEY_RE = /^(lat|lng|latitude|longitude)$/i

function collectLocationKeys(value: unknown, path = ''): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectLocationKeys(item, `${path}[${i}]`))
  }
  if (typeof value !== 'object') return []
  const hits: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key
    if (LOCATION_KEY_RE.test(key)) hits.push(next)
    hits.push(...collectLocationKeys(child, next))
  }
  return hits
}

describe('collectLocalBackup has no location keys', () => {
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
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deep-scans backup payload and finds no lat/lng/latitude/longitude keys', async () => {
    // Poison local storage with legacy Lobby blobs — collect must still omit them.
    store.set(
      'ranked-gym:check-in',
      JSON.stringify({
        gymId: 'g1',
        gymName: 'Poison',
        checkedInAt: Date.now(),
        gym: { id: 'g1', name: 'Poison', lat: 48.85, lng: 2.35, address: 'Paris' },
      }),
    )
    store.set(
      'ranked-gym:custom-gyms',
      JSON.stringify([{ id: 'c1', name: 'Custom', lat: 45.7, lng: 4.8, address: 'Lyon' }]),
    )
    store.set(
      'ranked-gym:last-location',
      JSON.stringify({ label: 'Paris', source: 'gps', updatedAt: Date.now(), lat: 48.85, lng: 2.35 }),
    )

    const { collectLocalBackup, applyCloudBackupPayload } = await import('./cloudBackup')
    const payload = collectLocalBackup()

    expect(payload.lobby).toEqual({ customGyms: [], checkIn: null })
    expect(collectLocationKeys(payload)).toEqual([])

    // Applying an old payload with lobby coords must not restore them locally.
    applyCloudBackupPayload({
      ...payload,
      lobby: {
        customGyms: [{ id: 'old', name: 'Old', lat: 1, lng: 2, address: 'x' }],
        checkIn: {
          gymId: 'old',
          gymName: 'Old',
          checkedInAt: Date.now(),
          gym: { id: 'old', name: 'Old', lat: 1, lng: 2 },
        },
      },
    })
    expect(store.has('ranked-gym:check-in')).toBe(true) // still the poison we set, not re-applied
    // apply must not write new lobby keys via saveCheckIn/saveCustomGyms
    const { purgeLegacyLobbyLocationKeys } = await import('./legacyLobbyLocationCleanup')
    purgeLegacyLobbyLocationKeys()
    applyCloudBackupPayload({
      ...payload,
      lobby: {
        customGyms: [{ id: 'old', name: 'Old', lat: 1, lng: 2 }],
        checkIn: { gymId: 'old', gymName: 'Old', checkedInAt: 1, gym: { lat: 1, lng: 2 } },
      },
    })
    expect(store.has('ranked-gym:check-in')).toBe(false)
    expect(store.has('ranked-gym:custom-gyms')).toBe(false)
  })
})

describe('convexCloudBackup push args omit location', () => {
  it('backupPayloadToPushArgs never carries lat/lng keys', async () => {
    const { backupPayloadToPushArgs } = await import('./convexCloudBackup')
    const args = backupPayloadToPushArgs({
      version: 4,
      updatedAt: new Date().toISOString(),
      nutrition: { profile: null, journal: {} },
      training: {
        primarySportId: null,
        favoriteSportIds: [],
        stepsToday: 0,
        stepsDateKey: '',
        healthLinked: false,
        notificationsEnabled: false,
        templates: [],
        schedule: [],
        completed: [],
        workoutNotes: [],
        routines: [],
        lastSelectedRoutineId: null,
        lastSelectedSportId: null,
        activeWorkoutDraft: null,
        lastVoluntaryRoute: null,
      },
      lobby: {
        customGyms: [{ id: 'x', lat: 1, lng: 2 }],
        checkIn: { gym: { lat: 3, lng: 4 } },
      },
      sleep: [],
    })
    expect(args.lobby).toEqual({ customGyms: [], checkIn: null })
    expect(collectLocationKeys(args)).toEqual([])
  })
})
