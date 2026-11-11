import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Pont JS → RankedAlarmPlugin (jsName "RankedAlarm").
 * Même pattern que RestTimerLiveActivity : stub web qui ne throw PAS
 * et ne prétend jamais qu’une alarme est programmée.
 */

export type RankedAlarmDiagnostics = {
  native: boolean
  iosVersion: string
  alarmKitAvailable: boolean
  /** authorized | denied | notDetermined | unavailable | unknown */
  authorization: string
  alarmCount: number
  lastError: string | null
  hasUsageDescription: boolean
}

export type RankedAlarmNative = {
  isAvailable: () => Promise<{ available: boolean; native?: boolean }>
  checkPermissions: () => Promise<{ alarms: string }>
  requestPermissions: () => Promise<{ alarms: string }>
  createAlarm: (opts: {
    hour: number
    minute: number
    label?: string
    days?: string[]
    snoozeMinutes?: number
    snoozeEnabled?: boolean
    soundName?: string
  }) => Promise<{ id: string | null }>
  cancelAlarm: (opts: { id: string }) => Promise<void>
  getAlarms: () => Promise<{ alarms: Array<{ id: string }> }>
  verifyAlarm: (opts: { id: string }) => Promise<{ present: boolean }>
  openAppSettings: () => Promise<void>
  getDiagnostics: () => Promise<RankedAlarmDiagnostics>
  scheduleTestInOneMinute: () => Promise<{ id: string; secondsFromNow: number }>
}

const RankedAlarmWeb: RankedAlarmNative = {
  async isAvailable() {
    return { available: false, native: false }
  },
  async checkPermissions() {
    return { alarms: 'denied' }
  },
  async requestPermissions() {
    return { alarms: 'denied' }
  },
  async createAlarm() {
    throw new Error('RankedAlarm web stub — native plugin missing')
  },
  async cancelAlarm() {},
  async getAlarms() {
    return { alarms: [] }
  },
  async verifyAlarm() {
    return { present: false }
  },
  async openAppSettings() {},
  async getDiagnostics() {
    return {
      native: false,
      iosVersion: 'web',
      alarmKitAvailable: false,
      authorization: 'unavailable',
      alarmCount: 0,
      lastError: 'web stub',
      hasUsageDescription: false,
    }
  },
  async scheduleTestInOneMinute() {
    throw new Error('RankedAlarm web stub — native plugin missing')
  },
}

/** Must match RankedAlarmPlugin.jsName */
export const RANKED_ALARM_JS_NAME = 'RankedAlarm'

export const RankedAlarm = registerPlugin<RankedAlarmNative>(RANKED_ALARM_JS_NAME, {
  web: () => RankedAlarmWeb,
})

export function isRankedAlarmPluginAvailable(): boolean {
  return Capacitor.isPluginAvailable(RANKED_ALARM_JS_NAME)
}

export function isNativeIosShell(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}
