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

describe('sleep goal + bedtime reminder (local)', () => {
  beforeEach(() => {
    store.clear()
  })

  it('objectif défaut 8 h, clamp 5–12', async () => {
    const {
      getSleepGoalHours,
      saveSleepGoalHours,
      DEFAULT_SLEEP_GOAL_HOURS,
    } = await import('./sleepStorage')
    expect(getSleepGoalHours()).toBe(DEFAULT_SLEEP_GOAL_HOURS)
    expect(saveSleepGoalHours(8.5, { skipCloud: true })).toBe(8.5)
    expect(getSleepGoalHours()).toBe(8.5)
    expect(saveSleepGoalHours(2, { skipCloud: true })).toBe(5)
    expect(saveSleepGoalHours(20, { skipCloud: true })).toBe(12)
  })

  it('interrupteur heure d’aller dormir local', async () => {
    const {
      getBedtimeReminderEnabled,
      setBedtimeReminderEnabled,
      saveSleepSchedule,
    } = await import('./sleepStorage')
    expect(getBedtimeReminderEnabled()).toBe(false)
    saveSleepSchedule({ bedtime: '23:00', waketime: '07:00' }, { skipCloud: true })
    expect(getBedtimeReminderEnabled()).toBe(true)
    setBedtimeReminderEnabled(false, { skipCloud: true })
    expect(getBedtimeReminderEnabled()).toBe(false)
  })
})
