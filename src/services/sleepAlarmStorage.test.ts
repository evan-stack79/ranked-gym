import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

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

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('sleepAlarmStorage', () => {
  beforeEach(() => {
    store.clear()
  })

  it('defaults time to schedule waketime and persists locally', async () => {
    const { saveSleepSchedule } = await import('./sleepStorage')
    const {
      defaultSleepAlarmSettings,
      getSleepAlarmSettings,
      saveSleepAlarmSettings,
      SLEEP_ALARM_STORAGE_BASE,
    } = await import('./sleepAlarmStorage')

    saveSleepSchedule({ bedtime: '23:00', waketime: '06:45' }, { skipCloud: true })
    const defaults = defaultSleepAlarmSettings()
    expect(defaults.timeHm).toBe('06:45')
    expect(defaults.snoozeMinutes).toBe(9)

    saveSleepAlarmSettings({
      enabled: true,
      timeHm: '07:15',
      days: [1, 2, 3, 4, 5],
      label: 'Lever',
    })
    const loaded = getSleepAlarmSettings()
    expect(loaded.enabled).toBe(true)
    expect(loaded.timeHm).toBe('07:15')
    expect(store.get(SLEEP_ALARM_STORAGE_BASE)).toContain('07:15')
  })
})
