/**
 * Orchestre le réveil Sommeil :
 * - iOS 26+ : AlarmKit (plugin local RankedAlarm)
 * - iOS < 26 : une notification locale à l’heure (pas d’autre notif nuit)
 * - Web / Android : no-op (UI masquée)
 */

import { Capacitor } from '@capacitor/core'
import {
  SLEEP_ALARM_SOUND_FILE,
  SLEEP_ALARM_SOUND_ID,
  SLEEP_ALARM_SNOOZE_MINUTES,
  getSleepAlarmSettings,
  parseAlarmTimeHm,
  saveSleepAlarmSettings,
  type SleepAlarmSettings,
} from './sleepAlarmStorage'
import {
  SLEEP_ALARM_NOTIF_ACTION_TYPE,
  SLEEP_ALARM_NOTIF_IDS,
  SLEEP_ALARM_SNOOZE_ACTION_ID,
  SLEEP_ALARM_STOP_ACTION_ID,
  chooseAlarmBackend,
  snoozeFrom,
  toAlarmKitWeekday,
  toIosWeekday,
  type AlarmBackend,
} from '../utils/sleepAlarmSchedule'

type AlarmPlugin = {
  isAvailable: () => Promise<{ available: boolean }>
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
}

let alarmPlugin: AlarmPlugin | null | undefined

async function loadAlarmPlugin(): Promise<AlarmPlugin | null> {
  if (alarmPlugin !== undefined) return alarmPlugin
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    alarmPlugin = null
    return null
  }
  try {
    const mod = await import('@ranked-gym/capacitor-alarm')
    alarmPlugin = mod.Alarm as unknown as AlarmPlugin
    return alarmPlugin
  } catch {
    alarmPlugin = null
    return null
  }
}

async function loadLocalNotifications(): Promise<typeof import('@capacitor/local-notifications') | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await import('@capacitor/local-notifications')
  } catch {
    return null
  }
}

export function isSleepAlarmPlatformSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function resolveAlarmBackend(): Promise<AlarmBackend> {
  if (!isSleepAlarmPlatformSupported()) return 'unavailable'
  const plugin = await loadAlarmPlugin()
  let available = false
  if (plugin) {
    try {
      available = Boolean((await plugin.isAvailable()).available)
    } catch {
      available = false
    }
  }
  return chooseAlarmBackend({
    platform: 'ios',
    iosMajor: available ? 26 : null,
    alarmKitAvailable: available,
  })
}

async function cancelLocalAlarmNotifications(): Promise<void> {
  const mod = await loadLocalNotifications()
  if (!mod) return
  const ids = [
    ...Array.from({ length: 7 }, (_, i) => SLEEP_ALARM_NOTIF_IDS.byIosWeekday(i + 1)),
    SLEEP_ALARM_NOTIF_IDS.snooze,
    SLEEP_ALARM_NOTIF_IDS.once,
  ]
  await mod.LocalNotifications.cancel({
    notifications: ids.map((id) => ({ id })),
  })
}

async function cancelAlarmKit(id: string | null): Promise<void> {
  if (!id) return
  const plugin = await loadAlarmPlugin()
  if (!plugin) return
  try {
    await plugin.cancelAlarm({ id })
  } catch {
    // ignore — alarm may already be gone
  }
}

async function ensureNotifActions(
  mod: typeof import('@capacitor/local-notifications'),
  snoozeEnabled: boolean,
): Promise<void> {
  const actions = snoozeEnabled
    ? [
        { id: SLEEP_ALARM_SNOOZE_ACTION_ID, title: 'Répéter · 9 min' },
        { id: SLEEP_ALARM_STOP_ACTION_ID, title: 'Arrêter' },
      ]
    : [{ id: SLEEP_ALARM_STOP_ACTION_ID, title: 'Arrêter' }]
  await mod.LocalNotifications.registerActionTypes({
    types: [{ id: SLEEP_ALARM_NOTIF_ACTION_TYPE, actions }],
  })
}

async function scheduleLocalFallback(settings: SleepAlarmSettings): Promise<void> {
  const mod = await loadLocalNotifications()
  if (!mod) return
  await cancelLocalAlarmNotifications()

  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) return

  const perm = await mod.LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') {
    throw new Error('PERMISSION_DENIED')
  }

  await ensureNotifActions(mod, settings.snoozeEnabled)

  const sound =
    settings.soundId === SLEEP_ALARM_SOUND_ID ? `${SLEEP_ALARM_SOUND_FILE}.wav` : undefined

  const base = {
    title: settings.label || 'Réveil',
    body: 'Ranked Gym',
    sound,
    actionTypeId: SLEEP_ALARM_NOTIF_ACTION_TYPE,
    extra: { kind: 'sleep-alarm' as const },
  }

  if (settings.days.length === 0) {
    const at = new Date()
    at.setSeconds(0, 0)
    at.setHours(parsed.hour, parsed.minute, 0, 0)
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1)
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          ...base,
          id: SLEEP_ALARM_NOTIF_IDS.once,
          schedule: { at, allowWhileIdle: true },
        },
      ],
    })
    return
  }

  const notifications = settings.days.map((day) => {
    const iosWeekday = toIosWeekday(day)
    return {
      ...base,
      id: SLEEP_ALARM_NOTIF_IDS.byIosWeekday(iosWeekday),
      schedule: {
        on: { weekday: iosWeekday, hour: parsed.hour, minute: parsed.minute },
        allowWhileIdle: true as const,
      },
    }
  })

  await mod.LocalNotifications.schedule({ notifications })
}

async function scheduleAlarmKit(settings: SleepAlarmSettings): Promise<string> {
  const plugin = await loadAlarmPlugin()
  if (!plugin) throw new Error('ALARM_PLUGIN_MISSING')
  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) throw new Error('INVALID_TIME')

  const perm = await plugin.requestPermissions()
  if (perm.alarms !== 'granted') throw new Error('PERMISSION_DENIED')

  const days =
    settings.days.length > 0 ? settings.days.map(toAlarmKitWeekday) : undefined

  const result = await plugin.createAlarm({
    hour: parsed.hour,
    minute: parsed.minute,
    label: settings.label || 'Réveil',
    days,
    snoozeMinutes: settings.snoozeEnabled
      ? settings.snoozeMinutes || SLEEP_ALARM_SNOOZE_MINUTES
      : undefined,
    snoozeEnabled: settings.snoozeEnabled,
    soundName:
      settings.soundId === SLEEP_ALARM_SOUND_ID ? SLEEP_ALARM_SOUND_FILE : undefined,
  })

  if (!result.id) throw new Error('NO_ALARM_ID')
  return result.id
}

/** Cancel whatever is currently scheduled for the réveil. */
export async function cancelSleepAlarm(): Promise<void> {
  const settings = getSleepAlarmSettings()
  await cancelAlarmKit(settings.alarmKitId)
  await cancelLocalAlarmNotifications()
  if (settings.alarmKitId) {
    saveSleepAlarmSettings({ alarmKitId: null })
  }
}

/**
 * Persist settings + (re)schedule according to backend.
 * When disabled, cancels only — no night notifications left behind.
 */
export async function syncSleepAlarm(
  patch?: Partial<SleepAlarmSettings>,
): Promise<{ ok: boolean; backend: AlarmBackend; reason?: string }> {
  const settings = patch ? saveSleepAlarmSettings(patch) : getSleepAlarmSettings()
  const backend = await resolveAlarmBackend()

  if (backend === 'unavailable') {
    return { ok: false, backend, reason: 'UNSUPPORTED_PLATFORM' }
  }

  await cancelAlarmKit(settings.alarmKitId)
  await cancelLocalAlarmNotifications()

  if (!settings.enabled) {
    saveSleepAlarmSettings({ alarmKitId: null, enabled: false })
    return { ok: true, backend, reason: 'OFF' }
  }

  try {
    if (backend === 'alarmkit') {
      const id = await scheduleAlarmKit(settings)
      saveSleepAlarmSettings({ alarmKitId: id, enabled: true })
      return { ok: true, backend }
    }

    await scheduleLocalFallback(settings)
    saveSleepAlarmSettings({ alarmKitId: null, enabled: true })
    return { ok: true, backend }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SCHEDULE_FAILED'
    saveSleepAlarmSettings({ enabled: false, alarmKitId: null })
    return { ok: false, backend, reason }
  }
}

/** Handle local-notification snooze action → +9 min one-shot. */
export async function handleSleepAlarmNotificationAction(
  actionId: string,
): Promise<void> {
  if (actionId === SLEEP_ALARM_SNOOZE_ACTION_ID) {
    const settings = getSleepAlarmSettings()
    if (!settings.snoozeEnabled) return
    const mod = await loadLocalNotifications()
    if (!mod) return
    const at = snoozeFrom(new Date(), settings.snoozeMinutes || SLEEP_ALARM_SNOOZE_MINUTES)
    const sound =
      settings.soundId === SLEEP_ALARM_SOUND_ID ? `${SLEEP_ALARM_SOUND_FILE}.wav` : undefined
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          id: SLEEP_ALARM_NOTIF_IDS.snooze,
          title: settings.label || 'Réveil',
          body: 'Répéter · 9 min',
          sound,
          actionTypeId: SLEEP_ALARM_NOTIF_ACTION_TYPE,
          schedule: { at, allowWhileIdle: true },
          extra: { kind: 'sleep-alarm-snooze' },
        },
      ],
    })
    return
  }
  if (actionId === SLEEP_ALARM_STOP_ACTION_ID) {
    await cancelLocalAlarmNotifications()
  }
}

/** Fallback copy shown under the alarm settings when not on AlarmKit. */
export function sleepAlarmFallbackHint(backend: AlarmBackend): string | null {
  if (backend === 'local-notification') {
    return 'Sur cette version d’iOS, le son peut être coupé en mode silencieux.'
  }
  return null
}
