/**
 * Orchestre le réveil Sommeil via RankedAlarm (App-local Capacitor plugin).
 *
 * Preuve IPA cbf74d0 : si le pont JS tombe sur le stub web, l’ancien code
 * basculait en notification locale → aucune invite AlarmKit. Ici :
 * - isPluginAvailable('RankedAlarm') obligatoire sur iOS
 * - aucun « OK » via stub web / notif locale quand AlarmKit est attendu
 */

import {
  RANKED_ALARM_JS_NAME,
  RankedAlarm,
  isNativeIosShell,
  isRankedAlarmPluginAvailable,
  type RankedAlarmDiagnostics,
} from '../native/rankedAlarm'
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

export type { RankedAlarmDiagnostics }

async function loadLocalNotifications(): Promise<typeof import('@capacitor/local-notifications') | null> {
  if (!isNativeIosShell()) return null
  try {
    return await import('@capacitor/local-notifications')
  } catch {
    return null
  }
}

export function isSleepAlarmPlatformSupported(): boolean {
  return isNativeIosShell()
}

/**
 * Backend choice — never pretends AlarmKit works without the native plugin.
 */
export async function resolveAlarmBackend(): Promise<AlarmBackend | 'plugin-missing'> {
  if (!isNativeIosShell()) return 'unavailable'
  if (!isRankedAlarmPluginAvailable()) return 'plugin-missing'
  try {
    const { available } = await RankedAlarm.isAvailable()
    return chooseAlarmBackend({
      platform: 'ios',
      iosMajor: available ? 26 : null,
      alarmKitAvailable: available,
    })
  } catch (err) {
    console.error('[sleep-alarm] isAvailable failed', err)
    return 'plugin-missing'
  }
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
  if (!id || !isRankedAlarmPluginAvailable()) return
  try {
    await RankedAlarm.cancelAlarm({ id })
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
  if (perm.display !== 'granted') throw new Error('PERMISSION_DENIED')
  await ensureNotifActions(mod, settings.snoozeEnabled)
  const sound =
    settings.soundId === SLEEP_ALARM_SOUND_ID ? SLEEP_ALARM_SOUND_FILE : undefined
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
      notifications: [{ ...base, id: SLEEP_ALARM_NOTIF_IDS.once, schedule: { at, allowWhileIdle: true } }],
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
  if (!isRankedAlarmPluginAvailable()) throw new Error('ALARM_PLUGIN_MISSING')
  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) throw new Error('INVALID_TIME')

  const perm = await RankedAlarm.requestPermissions()
  if (perm.alarms !== 'granted') throw new Error('PERMISSION_DENIED')

  const days =
    settings.days.length > 0 ? settings.days.map(toAlarmKitWeekday) : undefined

  const result = await RankedAlarm.createAlarm({
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

  const v = await RankedAlarm.verifyAlarm({ id: result.id })
  if (!v.present) throw new Error('NOT_CONFIRMED')
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
  backend: AlarmBackend | 'plugin-missing'
  reason?: string
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
  if (backend === 'plugin-missing') {
    saveSleepAlarmSettings({ enabled: false, alarmKitId: null })
    return { ok: false, backend, reason: 'ALARM_PLUGIN_MISSING' }
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
    // Pre-iOS 26 only
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

export async function handleSleepAlarmNotificationAction(actionId: string): Promise<void> {
  if (actionId === SLEEP_ALARM_SNOOZE_ACTION_ID) {
    const settings = getSleepAlarmSettings()
    if (!settings.snoozeEnabled) return
    const mod = await loadLocalNotifications()
    if (!mod) return
    const at = snoozeFrom(new Date(), settings.snoozeMinutes || SLEEP_ALARM_SNOOZE_MINUTES)
    const sound =
      settings.soundId === SLEEP_ALARM_SOUND_ID ? SLEEP_ALARM_SOUND_FILE : undefined
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

export function sleepAlarmFallbackHint(backend: AlarmBackend | 'plugin-missing'): string | null {
  if (backend === 'local-notification') {
    return 'Sur cette version d’iOS, le son peut être coupé en mode silencieux.'
  }
  if (backend === 'plugin-missing') {
    return 'Plugin natif RankedAlarm introuvable — le réveil ne peut pas sonner.'
  }
  return null
}

export type SleepAlarmUiStatus =
  | { kind: 'off' }
  | { kind: 'scheduled'; timeHm: string; summary: string }
  | { kind: 'permission' }
  | { kind: 'error'; message: string }

export function formatAlarmScheduledMessage(timeHm: string): string {
  const parsed = parseAlarmTimeHm(timeHm)
  const hhmm = parsed
    ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`
    : timeHm
  return `Réveil prévu à ${hhmm}`
}

export async function readSleepAlarmUiStatus(): Promise<SleepAlarmUiStatus> {
  if (!isSleepAlarmPlatformSupported()) return { kind: 'off' }
  const settings = getSleepAlarmSettings()
  if (!settings.enabled) return { kind: 'off' }

  const backend = await resolveAlarmBackend()
  if (backend === 'plugin-missing') {
    return { kind: 'error', message: 'Plugin natif RankedAlarm introuvable.' }
  }
  if (backend === 'alarmkit') {
    if (!isRankedAlarmPluginAvailable()) {
      return { kind: 'error', message: 'Plugin natif RankedAlarm introuvable.' }
    }
    try {
      const perm = await RankedAlarm.checkPermissions()
      if (perm.alarms !== 'granted') return { kind: 'permission' }
      if (!settings.alarmKitId) {
        return { kind: 'error', message: 'Le réveil n’est pas confirmé. Enregistre-le à nouveau.' }
      }
      const present = (await RankedAlarm.verifyAlarm({ id: settings.alarmKitId })).present
      if (!present) {
        return { kind: 'error', message: 'Le réveil n’est plus enregistré. Enregistre-le à nouveau.' }
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
  if (isRankedAlarmPluginAvailable()) {
    await RankedAlarm.openAppSettings()
    return
  }
  if (typeof window !== 'undefined') window.location.href = 'app-settings:'
}

export function syncFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case 'PERMISSION_DENIED':
      return 'Autorise les alarmes pour Ranked Gym dans Réglages'
    case 'ALARM_PLUGIN_MISSING':
    case 'PLUGIN_MISSING':
      return 'Plugin natif RankedAlarm introuvable — redémarre l’app.'
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

export function getBuildSha(): string {
  const envSha = (import.meta.env.VITE_GIT_SHA as string | undefined)?.trim()
  if (envSha) return envSha.slice(0, 12)
  try {
    // Injected by vite.config.ts from GITHUB_SHA / CF / Workers CI.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__) {
      return String(__APP_BUILD_ID__).slice(0, 12)
    }
  } catch {
    /* ignore */
  }
  return 'dev'
}

export type SleepAlarmDiagView = RankedAlarmDiagnostics & {
  buildSha: string
  pluginAvailable: boolean
  pluginJsName: string
  capacitorNative: boolean
  platform: string
}

export async function collectSleepAlarmDiagnostics(): Promise<SleepAlarmDiagView> {
  const { Capacitor } = await import('@capacitor/core')
  const base = {
    buildSha: getBuildSha(),
    pluginAvailable: isRankedAlarmPluginAvailable(),
    pluginJsName: RANKED_ALARM_JS_NAME,
    capacitorNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  }
  if (!isRankedAlarmPluginAvailable()) {
    return {
      ...base,
      native: false,
      iosVersion: typeof navigator !== 'undefined' ? navigator.userAgent : '?',
      alarmKitAvailable: false,
      authorization: 'unavailable',
      alarmCount: 0,
      lastError: 'isPluginAvailable(RankedAlarm)=false',
      hasUsageDescription: false,
    }
  }
  try {
    const d = await RankedAlarm.getDiagnostics()
    return { ...base, ...d }
  } catch (err) {
    return {
      ...base,
      native: true,
      iosVersion: '?',
      alarmKitAvailable: false,
      authorization: 'unknown',
      alarmCount: 0,
      lastError: err instanceof Error ? err.message : String(err),
      hasUsageDescription: false,
    }
  }
}

export async function runOneMinuteAlarmTest(): Promise<{
  ok: boolean
  id?: string
  reason?: string
  diagnostics: SleepAlarmDiagView
}> {
  if (!isRankedAlarmPluginAvailable()) {
    return {
      ok: false,
      reason: 'ALARM_PLUGIN_MISSING',
      diagnostics: await collectSleepAlarmDiagnostics(),
    }
  }
  try {
    const perm = await RankedAlarm.requestPermissions()
    if (perm.alarms !== 'granted') {
      return {
        ok: false,
        reason: 'PERMISSION_DENIED',
        diagnostics: await collectSleepAlarmDiagnostics(),
      }
    }
    const result = await RankedAlarm.scheduleTestInOneMinute()
    return {
      ok: true,
      id: result.id,
      diagnostics: await collectSleepAlarmDiagnostics(),
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'SCHEDULE_FAILED',
      diagnostics: await collectSleepAlarmDiagnostics(),
    }
  }
}
