/**
 * Orchestre le réveil Sommeil :
 * - iOS 26+ : AlarmKit (plugin local RankedAlarm) — auth AVANT schedule
 * - iOS < 26 : une notification locale à l’heure
 * - Web / Android : no-op (UI masquée)
 *
 * Bug Evan (f1a9516) : aucune invite AlarmKit → le chemin natif n’était
 * probablement jamais atteint ou l’échec était avalé. Ici : auth explicite,
 * erreurs remontées, confirmation relue via getAlarms/verifyAlarm.
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
  formatRepeatSummary,
  nextAlarmDate,
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
  getAlarms: () => Promise<{ alarms: Array<{ id: string }> }>
  verifyAlarm?: (opts: { id: string }) => Promise<{ present: boolean }>
  openAppSettings?: () => Promise<void>
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
    const plugin = mod.Alarm as unknown as AlarmPlugin
    // Refuse web stub: isAvailable must not throw "unimplemented".
    try {
      await plugin.isAvailable()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('not implemented') || msg.toLowerCase().includes('unimplemented')) {
        console.error('[sleep-alarm] Alarm plugin is web stub — native RankedAlarm not registered')
        alarmPlugin = null
        return null
      }
      // Other errors: still keep plugin (e.g. transient)
    }
    alarmPlugin = plugin
    return alarmPlugin
  } catch (err) {
    console.error('[sleep-alarm] failed to load Alarm plugin', err)
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
  if (!plugin) {
    // Native iOS but plugin missing → do NOT silently pretend AlarmKit works.
    // Fall back to local notification only on pre-26 (isAvailable false without throw).
    return 'local-notification'
  }
  let available = false
  try {
    available = Boolean((await plugin.isAvailable()).available)
  } catch (err) {
    console.error('[sleep-alarm] isAvailable failed', err)
    available = false
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
  } catch (err) {
    console.warn('[sleep-alarm] cancelAlarm', err)
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
  if (!mod) throw new Error('PLUGIN_MISSING')
  await cancelLocalAlarmNotifications()

  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) throw new Error('INVALID_TIME')

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
    const at = nextAlarmDate(parsed.hour, parsed.minute, [])
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

/**
 * Auth FIRST (system AlarmKit prompt), then schedule, then verify via AlarmManager list.
 */
async function scheduleAlarmKit(settings: SleepAlarmSettings): Promise<string> {
  const plugin = await loadAlarmPlugin()
  if (!plugin) throw new Error('ALARM_PLUGIN_MISSING')
  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) throw new Error('INVALID_TIME')

  // Explicit auth before any schedule — surfaces the system dialog on first use.
  const perm = await plugin.requestPermissions()
  if (perm.alarms !== 'granted') {
    throw new Error('PERMISSION_DENIED')
  }

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

  // Re-read from AlarmManager — never assume.
  if (plugin.verifyAlarm) {
    const v = await plugin.verifyAlarm({ id: result.id })
    if (!v.present) throw new Error('NOT_CONFIRMED')
  } else {
    const listed = await plugin.getAlarms()
    if (!listed.alarms.some((a) => a.id === result.id)) throw new Error('NOT_CONFIRMED')
  }

  return result.id
}

export async function cancelSleepAlarm(): Promise<void> {
  const settings = getSleepAlarmSettings()
  await cancelAlarmKit(settings.alarmKitId)
  await cancelLocalAlarmNotifications()
  if (settings.alarmKitId || settings.enabled) {
    saveSleepAlarmSettings({ alarmKitId: null, enabled: false })
  }
}

export type SyncSleepAlarmResult = {
  ok: boolean
  backend: AlarmBackend
  reason?: string
  /** Confirmed scheduled time HH:MM when ok */
  timeHm?: string
}

export async function syncSleepAlarm(
  patch?: Partial<SleepAlarmSettings>,
): Promise<SyncSleepAlarmResult> {
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
      return { ok: true, backend, timeHm: settings.timeHm }
    }

    await scheduleLocalFallback(settings)
    saveSleepAlarmSettings({ alarmKitId: null, enabled: true })
    return { ok: true, backend, timeHm: settings.timeHm }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SCHEDULE_FAILED'
    console.error('[sleep-alarm] sync failed', reason, err)
    saveSleepAlarmSettings({ enabled: false, alarmKitId: null })
    return { ok: false, backend, reason }
  }
}

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

export function sleepAlarmFallbackHint(backend: AlarmBackend): string | null {
  if (backend === 'local-notification') {
    return 'Sur cette version d’iOS, le son peut être coupé en mode silencieux.'
  }
  return null
}

export type SleepAlarmUiStatus =
  | { kind: 'off' }
  | { kind: 'scheduled'; timeHm: string; summary: string }
  | { kind: 'permission' }
  | { kind: 'error'; message: string }

/** Exact confirmation copy required by product — « Réveil prévu à HH:MM ». */
export function formatAlarmScheduledMessage(timeHm: string): string {
  const parsed = parseAlarmTimeHm(timeHm)
  const hhmm = parsed
    ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`
    : timeHm
  return `Réveil prévu à ${hhmm}`
}

/**
 * Status for sheet + Accueil night block.
 * When AlarmKit id is set, re-reads AlarmManager list.
 */
export async function readSleepAlarmUiStatus(): Promise<SleepAlarmUiStatus> {
  if (!isSleepAlarmPlatformSupported()) return { kind: 'off' }
  const settings = getSleepAlarmSettings()
  if (!settings.enabled) return { kind: 'off' }

  const backend = await resolveAlarmBackend()
  if (backend === 'alarmkit') {
    const plugin = await loadAlarmPlugin()
    if (!plugin) {
      return { kind: 'error', message: 'Réveil indisponible sur cet appareil.' }
    }
    try {
      const perm = await plugin.checkPermissions()
      if (perm.alarms === 'denied') return { kind: 'permission' }
      if (perm.alarms !== 'granted') return { kind: 'permission' }

      if (settings.alarmKitId) {
        let present = false
        if (plugin.verifyAlarm) {
          present = (await plugin.verifyAlarm({ id: settings.alarmKitId })).present
        } else {
          const listed = await plugin.getAlarms()
          present = listed.alarms.some((a) => a.id === settings.alarmKitId)
        }
        if (!present) {
          return {
            kind: 'error',
            message: 'Le réveil n’est plus enregistré. Enregistre-le à nouveau.',
          }
        }
      } else {
        return {
          kind: 'error',
          message: 'Le réveil n’est pas confirmé. Enregistre-le à nouveau.',
        }
      }
    } catch (err) {
      console.error('[sleep-alarm] status read failed', err)
      return { kind: 'error', message: 'Impossible de vérifier le réveil.' }
    }
  }

  return {
    kind: 'scheduled',
    timeHm: settings.timeHm,
    summary: formatRepeatSummary(settings.days),
  }
}

export async function openSleepAlarmSettings(): Promise<void> {
  const plugin = await loadAlarmPlugin()
  if (plugin?.openAppSettings) {
    await plugin.openAppSettings()
    return
  }
  // Fallback: App Settings URL (may be ignored on web).
  if (typeof window !== 'undefined') {
    window.location.href = 'app-settings:'
  }
}

export function syncFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case 'PERMISSION_DENIED':
      return 'Autorise les alarmes pour Ranked Gym dans Réglages'
    case 'ALARM_PLUGIN_MISSING':
    case 'PLUGIN_MISSING':
      return 'Réveil indisponible — redémarre l’app puis réessaie.'
    case 'NOT_CONFIRMED':
    case 'NO_ALARM_ID':
      return 'Le réveil n’a pas pu être confirmé. Réessaie.'
    case 'INVALID_TIME':
      return 'Horaires invalides.'
    case 'UNSUPPORTED_PLATFORM':
      return 'Le réveil est dispo sur l’app iPhone.'
    default:
      return 'Impossible d’enregistrer le réveil.'
  }
}
