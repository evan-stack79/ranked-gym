/**
 * Orchestre le réveil Sommeil via RankedAlarm (App-local Capacitor plugin).
 *
 * Reliability:
 * - « Dormir maintenant » = one-shot (days: []) → AlarmKit `.relative(.never)`
 * - Make-before-break lives in native createAlarm (verify, then cancelAll except new)
 * - syncSleepAlarm is serialized; last request wins
 * - cancelAll on disable / logout
 */

import {
  RANKED_ALARM_JS_NAME,
  RankedAlarm,
  isNativeIosShell,
  isRankedAlarmPluginAvailable,
  type RankedAlarmDiagnostics,
  type RankedAlarmRow,
} from '../native/rankedAlarm'
import {
  SLEEP_ALARM_SOUND_FILE,
  SLEEP_ALARM_SOUND_FILE_LN,
  SLEEP_ALARM_SOUND_ID,
  SLEEP_ALARM_SNOOZE_MINUTES,
  clearSleepAlarmSettings,
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
  formatAlarmReadback,
  formatRepeatSummary,
  nextAlarmDate,
  nextOneShotAlarmDate,
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

async function ensureNotifActions(
  mod: typeof import('@capacitor/local-notifications'),
  snoozeEnabled: boolean,
): Promise<void> {
  const actions = snoozeEnabled
    ? [
        {
          id: SLEEP_ALARM_SNOOZE_ACTION_ID,
          title: 'Encore 9 min',
          foreground: true,
        },
          { id: SLEEP_ALARM_STOP_ACTION_ID, title: 'Stop', foreground: true },
      ]
    : [{ id: SLEEP_ALARM_STOP_ACTION_ID, title: 'Stop', foreground: true }]
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
    settings.soundId === SLEEP_ALARM_SOUND_ID ? SLEEP_ALARM_SOUND_FILE_LN : undefined
  const base = {
    title: settings.label || 'Réveil',
    body: "C'est l'heure !",
    sound,
    actionTypeId: SLEEP_ALARM_NOTIF_ACTION_TYPE,
    interruptionLevel: 'timeSensitive' as const,
    extra: { kind: 'sleep-alarm' as const },
  }
  // One-shot from Sommeil (empty days) or weekly when days set in sheet.
  if (settings.days.length === 0) {
    const at = nextOneShotAlarmDate(parsed.hour, parsed.minute)
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

/** Pure ordering helper — exposed for unit tests (create → verify → cancel others). */
export function makeBeforeBreakSteps(): readonly [
  'create',
  'verify',
  'cancelOthers',
] {
  return ['create', 'verify', 'cancelOthers'] as const
}

async function scheduleAlarmKit(settings: SleepAlarmSettings): Promise<string> {
  if (!isRankedAlarmPluginAvailable()) throw new Error('ALARM_PLUGIN_MISSING')
  const parsed = parseAlarmTimeHm(settings.timeHm)
  if (!parsed) throw new Error('INVALID_TIME')

  const perm = await RankedAlarm.requestPermissions()
  if (perm.alarms !== 'granted') throw new Error('PERMISSION_DENIED')

  // Empty days → native `.relative(.never)`. Native createAlarm verifies then cancelAll(except: id).
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

export async function cancelSleepAlarm(): Promise<{ remaining: number }> {
  let remaining = 0
  if (isRankedAlarmPluginAvailable()) {
    try {
      const r = await RankedAlarm.cancelAll()
      remaining = r.remaining
    } catch (err) {
      console.warn('[sleep-alarm] cancelAll', err)
    }
  }
  await cancelLocalAlarmNotifications()
  saveSleepAlarmSettings({ alarmKitId: null, enabled: false })
  return { remaining }
}

/** Call on logout / account change — wipe AlarmKit + local storage. */
export async function cancelAllSleepAlarmsOnLogout(): Promise<void> {
  try {
    if (isRankedAlarmPluginAvailable()) {
      await RankedAlarm.cancelAll()
    }
  } catch (err) {
    console.warn('[sleep-alarm] logout cancelAll', err)
  }
  await cancelLocalAlarmNotifications()
  clearSleepAlarmSettings()
}

export type SyncSleepAlarmResult = {
  ok: boolean
  backend: AlarmBackend | 'plugin-missing'
  reason?: string
  timeHm?: string
  readback?: string
  fireAtIso?: string
  superseded?: boolean
}

let syncToken = 0
let syncGate: Promise<void> = Promise.resolve()

/** @internal — reset between unit tests. */
export function __resetSleepAlarmSyncGateForTests(): void {
  syncToken = 0
  syncGate = Promise.resolve()
}

async function syncSleepAlarmBody(
  patch: Partial<SleepAlarmSettings> | undefined,
): Promise<SyncSleepAlarmResult> {
  // Shared planning: when Emploi du temps variable is on, HV owns AlarmKit arming.
  try {
    const { isHvModeActive } = await import('./horairesVariables/storage')
    const { syncHvAlarms } = await import('./horairesVariables/sync')
    if (isHvModeActive()) {
      if (patch) saveSleepAlarmSettings(patch)
      const hv = await syncHvAlarms()
      const backend = await resolveAlarmBackend()
      if (!hv.ok) {
        return {
          ok: false,
          backend: backend === 'unavailable' ? 'unavailable' : backend,
          reason: hv.reason,
        }
      }
      const settings = getSleepAlarmSettings()
      return {
        ok: true,
        backend: backend === 'unavailable' ? 'unavailable' : backend,
        timeHm: settings.timeHm,
        reason: hv.reason ?? 'HV',
      }
    }
  } catch (err) {
    console.warn('[sleep-alarm] hv gate', err)
  }

  const settings = patch ? saveSleepAlarmSettings(patch) : getSleepAlarmSettings()
  const backend = await resolveAlarmBackend()

  if (backend === 'unavailable') {
    return { ok: false, backend, reason: 'UNSUPPORTED_PLATFORM' }
  }
  if (backend === 'plugin-missing') {
    // Keep previous alarmKitId — do not disable silently after a plugin race.
    return { ok: false, backend, reason: 'ALARM_PLUGIN_MISSING' }
  }

  if (!settings.enabled) {
    await cancelSleepAlarm()
    return { ok: true, backend, reason: 'OFF' }
  }

  try {
    if (backend === 'alarmkit') {
      // Make-before-break: do NOT cancel the old alarm first.
      // Native createAlarm schedules, verifies, then cancelAll(except: newId).
      const id = await scheduleAlarmKit(settings)
      saveSleepAlarmSettings({ alarmKitId: id, enabled: true })
      const parsed = parseAlarmTimeHm(settings.timeHm)
      const fireAt = parsed
        ? settings.days.length === 0
          ? nextOneShotAlarmDate(parsed.hour, parsed.minute)
          : nextAlarmDate(parsed.hour, parsed.minute, settings.days)
        : null
      return {
        ok: true,
        backend,
        timeHm: settings.timeHm,
        readback: fireAt ? formatAlarmReadback(fireAt) : undefined,
        fireAtIso: fireAt?.toISOString(),
      }
    }
    await scheduleLocalFallback(settings)
    saveSleepAlarmSettings({ alarmKitId: null, enabled: true })
    const parsed = parseAlarmTimeHm(settings.timeHm)
    const fireAt = parsed
      ? nextAlarmDate(parsed.hour, parsed.minute, settings.days)
      : null
    return {
      ok: true,
      backend,
      timeHm: settings.timeHm,
      readback: fireAt ? formatAlarmReadback(fireAt) : undefined,
      fireAtIso: fireAt?.toISOString(),
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SCHEDULE_FAILED'
    console.error('[sleep-alarm] sync failed', reason, err)
    // Keep previous enabled/alarmKitId — old alarm still rings if create failed.
    return { ok: false, backend, reason }
  }
}

/**
 * Serialize schedules; last request wins (superseded mid-flight callers skip work).
 */
export async function syncSleepAlarm(
  patch?: Partial<SleepAlarmSettings>,
): Promise<SyncSleepAlarmResult> {
  const token = ++syncToken
  const prev = syncGate
  let release!: () => void
  syncGate = new Promise<void>((r) => {
    release = r
  })
  await prev
  try {
    if (token !== syncToken) {
      return {
        ok: true,
        backend: 'alarmkit',
        reason: 'SUPERSEDED',
        superseded: true,
      }
    }
    return await syncSleepAlarmBody(patch)
  } finally {
    release()
  }
}

export async function handleSleepAlarmNotificationAction(actionId: string): Promise<void> {
  if (actionId === SLEEP_ALARM_SNOOZE_ACTION_ID) {
    const settings = getSleepAlarmSettings()
    if (!settings.snoozeEnabled) return
    const mod = await loadLocalNotifications()
    if (!mod) return
    await ensureNotifActions(mod, true)
    const at = snoozeFrom(new Date(), settings.snoozeMinutes || SLEEP_ALARM_SNOOZE_MINUTES)
    const sound =
      settings.soundId === SLEEP_ALARM_SOUND_ID ? SLEEP_ALARM_SOUND_FILE_LN : undefined
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          id: SLEEP_ALARM_NOTIF_IDS.snooze,
          title: settings.label || 'Réveil',
          body: 'Encore 9 min',
          sound,
          actionTypeId: SLEEP_ALARM_NOTIF_ACTION_TYPE,
          interruptionLevel: 'timeSensitive',
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
    return 'Mode silencieux : le son peut être coupé.'
  }
  if (backend === 'plugin-missing') {
    return "Le réveil ne marche pas. Relance l'app."
  }
  return null
}

export type SleepAlarmUiStatus =
  | { kind: 'off' }
  | {
      kind: 'scheduled'
      timeHm: string
      summary: string
      readback: string
      fireAtIso?: string
    }
  | {
      kind: 'mismatch'
      expected: number
      actual: number
      message: string
    }
  | { kind: 'permission' }
  | { kind: 'error'; message: string; openSettings?: boolean }

export function formatAlarmScheduledMessage(timeHm: string): string {
  const parsed = parseAlarmTimeHm(timeHm)
  const hhmm = parsed
    ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`
    : timeHm
  return `Réveil à ${hhmm}`
}

function pickPrimaryAlarm(alarms: RankedAlarmRow[]): RankedAlarmRow | null {
  if (alarms.length === 0) return null
  const withFire = [...alarms].sort((a, b) => (a.nextFireAtMs ?? 0) - (b.nextFireAtMs ?? 0))
  return withFire[0] ?? alarms[0] ?? null
}

export async function readSleepAlarmUiStatus(): Promise<SleepAlarmUiStatus> {
  if (!isSleepAlarmPlatformSupported()) return { kind: 'off' }
  const settings = getSleepAlarmSettings()
  if (!settings.enabled) {
    if (isRankedAlarmPluginAvailable()) {
      try {
        const { alarms } = await RankedAlarm.getAlarms()
        if (alarms.length !== 0) {
          return {
            kind: 'mismatch',
            expected: 0,
            actual: alarms.length,
            message: 'Souci avec ton réveil. Règle-le à nouveau.',
          }
        }
      } catch {
        /* ignore */
      }
    }
    return { kind: 'off' }
  }

  const backend = await resolveAlarmBackend()
  if (backend === 'plugin-missing') {
    return {
      kind: 'error',
      message: "Le réveil ne marche pas. Relance l'app.",
      openSettings: false,
    }
  }
  if (backend === 'alarmkit') {
    if (!isRankedAlarmPluginAvailable()) {
      return {
        kind: 'error',
        message: "Le réveil ne marche pas. Relance l'app.",
        openSettings: false,
      }
    }
    try {
      const perm = await RankedAlarm.checkPermissions()
      if (perm.alarms !== 'granted') return { kind: 'permission' }
      const { alarms } = await RankedAlarm.getAlarms()
      if (alarms.length !== 1) {
        return {
          kind: 'mismatch',
          expected: 1,
          actual: alarms.length,
          message:
            alarms.length === 0
              ? 'Ton réveil a sauté. Règle-le à nouveau.'
              : 'Trop de réveils. Règle-le à nouveau.',
        }
      }
      const primary = pickPrimaryAlarm(alarms)
      if (!primary) {
        return {
          kind: 'mismatch',
          expected: 1,
          actual: 0,
          message: 'Ton réveil a sauté. Règle-le à nouveau.',
        }
      }
      const hour = primary.hour ?? parseAlarmTimeHm(settings.timeHm)?.hour ?? 7
      const minute = primary.minute ?? parseAlarmTimeHm(settings.timeHm)?.minute ?? 0
      const timeHm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const fireAt =
        typeof primary.nextFireAtMs === 'number'
          ? new Date(primary.nextFireAtMs)
          : primary.nextFireAt
            ? new Date(primary.nextFireAt)
            : nextOneShotAlarmDate(hour, minute)
      return {
        kind: 'scheduled',
        timeHm,
        summary: formatRepeatSummary(
          primary.repeats === 'weekly' ? settings.days : [],
        ),
        readback: formatAlarmReadback(fireAt),
        fireAtIso: fireAt.toISOString(),
      }
    } catch (err) {
      console.error('[sleep-alarm] status read failed', err)
      return { kind: 'error', message: "Je n'arrive pas à voir ton réveil.", openSettings: true }
    }
  }

  const parsed = parseAlarmTimeHm(settings.timeHm)
  const fireAt = parsed
    ? nextAlarmDate(parsed.hour, parsed.minute, settings.days)
    : null
  return {
    kind: 'scheduled',
    timeHm: settings.timeHm,
    summary: formatRepeatSummary(settings.days),
    readback: fireAt ? formatAlarmReadback(fireAt) : formatAlarmScheduledMessage(settings.timeHm),
    fireAtIso: fireAt?.toISOString(),
  }
}

export async function openSleepAlarmSettings(): Promise<void> {
  if (isRankedAlarmPluginAvailable()) {
    await RankedAlarm.openAppSettings()
    return
  }
  if (typeof window !== 'undefined') window.location.href = 'app-settings:'
}

export async function readBatteryWarning(): Promise<boolean> {
  if (!isRankedAlarmPluginAvailable()) return false
  try {
    const bat = await RankedAlarm.getBattery()
    if (bat.unknown || bat.level == null) return false
    return bat.level < 0.2 && !bat.charging
  } catch {
    return false
  }
}

export function syncFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case 'PERMISSION_DENIED':
      return 'Autorise les alarmes'
    case 'ALARM_PLUGIN_MISSING':
    case 'PLUGIN_MISSING':
      return "Le réveil ne marche pas. Relance l'app."
    case 'NOT_CONFIRMED':
    case 'NO_ALARM_ID':
      return 'Réveil pas réglé. Réessaie.'
    case 'INVALID_TIME':
      return 'Heure pas valable.'
    case 'UNSUPPORTED_PLATFORM':
      return "Le réveil marche dans l'app iPhone."
    default:
      return 'Réveil pas enregistré. Réessaie.'
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
      lastError: "Le réveil ne marche pas. Relance l'app.",
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
