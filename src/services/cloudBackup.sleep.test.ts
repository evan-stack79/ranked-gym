import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/adapter', () => ({
  isActiveCloudBackendConfigured: () => true,
  isConvexDomainActive: () => false,
}))

describe('cloudBackup sleep payload + pull-first gate', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
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

  it('includes sleep nights in collectLocalBackup (v4 gap fix)', async () => {
    const session = await import('./cloudSession')
    session.setActiveCloudUserId('user-sleep-1')
    const sleep = await import('./sleepStorage')
    sleep.saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 7, dateKey: '2026-09-12' },
      { skipCloud: true },
    )
    const cloud = await import('./cloudBackup')
    const payload = cloud.collectLocalBackup()
    expect(payload.version).toBe(4)
    expect(payload.sleep).toHaveLength(1)
    expect(payload.sleep?.[0]?.dateKey).toBe('2026-09-12')
    expect(cloud.hasMeaningfulCloudData(payload)).toBe(true)
  })

  it('applyBackup restores sleep without wiping it when skipCloud is used', async () => {
    const session = await import('./cloudSession')
    session.setActiveCloudUserId('user-sleep-2')
    const cloud = await import('./cloudBackup')
    const sleep = await import('./sleepStorage')
    const payload = cloud.collectLocalBackup()
    payload.sleep = [
      {
        id: 'sleep-2026-09-11',
        dateKey: '2026-09-11',
        bedtime: '22:30',
        waketime: '06:30',
        tstHours: 7,
        createdAt: '2026-09-11T06:30:00.000Z',
      },
    ]
    cloud.applyCloudBackupPayload(payload)
    expect(sleep.getSleepLog()).toHaveLength(1)
    expect(sleep.getLatestSleepNight()?.bedtime).toBe('22:30')
  })

  it('defers auto-push until hydration marks cloudSyncReady', async () => {
    const session = await import('./cloudSession')
    session.setActiveCloudUserId('user-gate')
    const cloud = await import('./cloudBackup')
    expect(cloud.isCloudSyncReady()).toBe(false)
    cloud.notifyLocalDataChanged()
    expect(cloud.getCloudBackupMeta().pending).toBe(true)
    expect(cloud.isCloudSyncReady()).toBe(false)
  })
})
