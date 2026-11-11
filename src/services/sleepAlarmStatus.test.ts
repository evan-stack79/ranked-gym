import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
})

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
    isPluginAvailable: () => false,
  },
  registerPlugin: () => ({
    isAvailable: async () => ({ available: false }),
    checkPermissions: async () => ({ alarms: 'denied' }),
    requestPermissions: async () => ({ alarms: 'denied' }),
    createAlarm: async () => {
      throw new Error('stub')
    },
    cancelAlarm: async () => {},
    getAlarms: async () => ({ alarms: [] }),
    verifyAlarm: async () => ({ present: false }),
    openAppSettings: async () => {},
    getDiagnostics: async () => ({
      native: false,
      iosVersion: 'web',
      alarmKitAvailable: false,
      authorization: 'unavailable',
      alarmCount: 0,
      lastError: 'web stub',
      hasUsageDescription: false,
    }),
    scheduleTestInOneMinute: async () => {
      throw new Error('stub')
    },
  }),
}))

describe('sleep alarm status copy', () => {
  it('uses exact confirmation wording', async () => {
    const { formatAlarmScheduledMessage, syncFailureMessage } = await import(
      './sleepAlarmService'
    )
    expect(formatAlarmScheduledMessage('21:00')).toBe('Réveil prévu à 21:00')
    expect(formatAlarmScheduledMessage('07:05')).toMatch(/^Réveil prévu à /)
    expect(syncFailureMessage('PERMISSION_DENIED')).toBe(
      'Autorise les alarmes pour Ranked Gym dans Réglages',
    )
    expect(syncFailureMessage('ALARM_PLUGIN_MISSING')).toMatch(/RankedAlarm/)
  })

  it('exposes build sha helper', async () => {
    const { getBuildSha } = await import('./sleepAlarmService')
    expect(typeof getBuildSha()).toBe('string')
    expect(getBuildSha().length).toBeGreaterThan(0)
  })
})
