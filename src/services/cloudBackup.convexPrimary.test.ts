import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetchConvexBackupPayload = vi.fn()
const mockPushConvexBackupPayload = vi.fn()
const mockGetSupabase = vi.fn(() => ({
  from: () => {
    throw new Error('Supabase fallback should not be called in Convex primary mode')
  },
}))

vi.mock('../backend/adapter', () => ({
  isActiveCloudBackendConfigured: () => true,
  isConvexDomainActive: () => true,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => mockGetSupabase(),
}))

vi.mock('./convexCloudBackup', () => ({
  fetchConvexBackupPayload: (...args: unknown[]) => mockFetchConvexBackupPayload(...args),
  pushConvexBackupPayload: (...args: unknown[]) => mockPushConvexBackupPayload(...args),
}))

describe('cloudBackup (Convex primary) no Supabase fallback', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    mockGetSupabase.mockClear()
    mockFetchConvexBackupPayload.mockReset()
    mockPushConvexBackupPayload.mockReset()

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
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

  it('pullCloudBackup surfaces Convex errors in French and does not call Supabase', async () => {
    mockFetchConvexBackupPayload.mockResolvedValue({
      payload: null,
      error: 'Failed to fetch',
      serverVersion: 0,
    })

    const cloud = await import('./cloudBackup')
    const result = await cloud.pullCloudBackup('convex-user')

    expect(result.ok).toBe(false)
    expect(result.applied).toBe(false)
    expect(result.error).toContain('Connexion réseau impossible')
    expect(mockGetSupabase).not.toHaveBeenCalled()
  })

  it('pushCloudBackup keeps pending writes locally on Convex failure and never hits Supabase', async () => {
    mockPushConvexBackupPayload.mockResolvedValue({
      error: 'Failed to fetch',
    })

    const nutritionStorage = await import('./nutritionStorage')
    nutritionStorage.saveCalorieProfile(
      {
        weightKg: 82,
        goalWeightKg: 80,
        heightCm: 180,
        age: 26,
        sex: 'male',
        activity: 'moderate',
        morphology: 'mesomorph',
        goal: 'maintain',
        weeklyPaceKg: 0.5,
        onboardingComplete: true,
      },
      { skipCloud: true },
    )

    const cloud = await import('./cloudBackup')
    cloud.setCloudBackupUserId('convex-user')
    const beforeWeight = cloud.collectLocalBackup().nutrition.profile?.weightKg
    const result = await cloud.pushCloudBackup('convex-user')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Connexion réseau impossible')
    expect(mockGetSupabase).not.toHaveBeenCalled()
    expect(cloud.getCloudBackupMeta().pending).toBe(true)
    expect(cloud.collectLocalBackup().nutrition.profile?.weightKg).toBe(beforeWeight)
  })
})
