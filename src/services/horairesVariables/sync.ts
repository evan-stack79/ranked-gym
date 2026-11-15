/**
 * Sync HV planning → AlarmKit fixed alarms (≤ HV_MAX_ARMED_ALARMS).
 * Does not alter classic createAlarm make-before-break path when HV is off.
 * Pause (Evan choice A): restore simple réveil + pre-arm planning from resume day.
 */

import {
  addDaysKey,
  buildArmedWakes,
  dateKeyOf,
  isHvPaused,
  parseHm,
  shouldAutoPause,
  vacationResumeKey,
} from '../../horaires-variables/engine'
import { HV_MAX_ARMED_ALARMS } from '../../horaires-variables/constants'
import {
  RankedAlarm,
  isRankedAlarmPluginAvailable,
} from '../../native/rankedAlarm'
import {
  SLEEP_ALARM_SOUND_FILE,
  getSleepAlarmSettings,
  saveSleepAlarmSettings,
} from '../sleepAlarmStorage'
import { getHvState, saveHvState } from './storage'

export type HvSyncResult = {
  ok: boolean
  armed: number
  ids: string[]
  reason?: string
  autoPaused?: boolean
}

function fireDateFor(dateKey: string, wakeHm: string): Date | null {
  const p = parseHm(wakeHm)
  if (!p) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, p.hour, p.minute, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getTime() <= Date.now() + 5_000) return null
  return dt
}

async function armFixedWakes(
  wakes: { dateKey: string; wakeHm: string }[],
  soundName: string | undefined,
): Promise<string[]> {
  const ids: string[] = []
  for (const w of wakes) {
    const fireAt = fireDateFor(w.dateKey, w.wakeHm)
    if (!fireAt) continue
    if (typeof RankedAlarm.createFixedAlarm !== 'function') {
      const first = wakes[0]
      if (!first) break
      const parsed = parseHm(first.wakeHm)
      if (!parsed) break
      // Classic createAlarm make-before-break (e1a8801) — single alarm only.
      const r = await RankedAlarm.createAlarm({
        hour: parsed.hour,
        minute: parsed.minute,
        label: 'Réveil',
        snoozeEnabled: true,
        snoozeMinutes: 9,
        soundName,
      })
      if (r.id) ids.push(r.id)
      break
    }
    const r = await RankedAlarm.createFixedAlarm({
      fireAtMs: fireAt.getTime(),
      label: 'Réveil',
      snoozeEnabled: true,
      snoozeMinutes: 9,
      soundName,
    })
    if (r.id) ids.push(r.id)
    if (ids.length >= HV_MAX_ARMED_ALARMS) break
  }
  return ids
}

/**
 * When HV is active and not paused: cancelAll then arm up to 14 fixed alarms.
 * Classic single-alarm createAlarm is not used (preserves e1a8801 for non-HV).
 * During pause (choice A): restore simple réveil + pre-arm from resume day.
 */
export async function syncHvAlarms(now = new Date()): Promise<HvSyncResult> {
  const state = getHvState()
  const today = dateKeyOf(now)

  if (!state.settings.enabled) {
    return { ok: true, armed: 0, ids: [], reason: 'OFF' }
  }

  const hasAnyStart = state.days.some((d) => Boolean(d.startHm))
  if (shouldAutoPause({ settings: state.settings, hasAnyStart, now })) {
    saveHvState({
      settings: { ...state.settings, autoPaused: true, autoPauseCardDismissed: false },
    })
    // Fall through to pause handling with updated settings
  }

  const fresh = getHvState()
  const pause = isHvPaused(fresh.settings, today)

  const soundName =
    getSleepAlarmSettings().soundId === 'none' ? undefined : SLEEP_ALARM_SOUND_FILE

  if (pause.paused) {
    // Choice A: simple réveil during pause + pre-arm planning from resume day.
    const simpleHm =
      fresh.settings.pauseSimpleWakeHm ||
      getSleepAlarmSettings().timeHm ||
      '07:30'
    const resumeKey =
      pause.reason === 'vacation' && fresh.settings.vacationPauseUntilKey
        ? vacationResumeKey(fresh.settings.vacationPauseUntilKey)
        : pause.reason === 'auto'
          ? today // auto: resume when user fills planning; still pre-arm from tomorrow
          : addDaysKey(today, 1)

    const fromKey = resumeKey && resumeKey > today ? resumeKey : addDaysKey(today, 1) ?? today
    const planningWakes = buildArmedWakes({
      days: fresh.days,
      trajetMin: fresh.settings.trajetMin,
      prepMin: fresh.settings.prepMin,
      fromDateKey: fromKey!,
      maxArmed: Math.max(0, HV_MAX_ARMED_ALARMS - 1),
      now,
    })

    // Simple réveil: next occurrence of simpleHm while paused
    const simpleParsed = parseHm(simpleHm)
    const simpleWakes: { dateKey: string; wakeHm: string }[] = []
    if (simpleParsed) {
      for (let i = 0; i < 7; i++) {
        const key = addDaysKey(today, i)
        if (!key) continue
        if (fromKey && key >= fromKey) break
        const fire = fireDateFor(key, simpleHm)
        if (fire) {
          simpleWakes.push({ dateKey: key, wakeHm: simpleHm })
          break // one simple alarm is enough; createAlarm path handles daily
        }
      }
    }

    saveSleepAlarmSettings({
      enabled: true,
      timeHm: simpleHm,
      days: [],
      alarmKitId: null,
    })

    if (!isRankedAlarmPluginAvailable()) {
      saveHvState({ armedAlarmIds: [] })
      return { ok: false, armed: 0, ids: [], reason: 'ALARM_PLUGIN_MISSING' }
    }

    try {
      const perm = await RankedAlarm.requestPermissions()
      if (perm.alarms !== 'granted') {
        return { ok: false, armed: 0, ids: [], reason: 'PERMISSION_DENIED' }
      }
      await RankedAlarm.cancelAll()

      // Arm simple via createAlarm (e1a8801 make-before-break) — daily-style single.
      const ids: string[] = []
      if (simpleParsed) {
        const r = await RankedAlarm.createAlarm({
          hour: simpleParsed.hour,
          minute: simpleParsed.minute,
          label: 'Réveil',
          snoozeEnabled: true,
          snoozeMinutes: 9,
          soundName,
        })
        if (r.id) ids.push(r.id)
        saveSleepAlarmSettings({
          enabled: true,
          timeHm: simpleHm,
          days: [],
          alarmKitId: r.id ?? null,
        })
      }

      // Pre-arm planning wakes from resume (fixed) without exceeding 14.
      const remaining = HV_MAX_ARMED_ALARMS - ids.length
      if (remaining > 0 && planningWakes.length > 0) {
        const more = await armFixedWakes(planningWakes.slice(0, remaining), soundName)
        ids.push(...more)
      }

      saveHvState({ armedAlarmIds: ids })
      return {
        ok: true,
        armed: ids.length,
        ids,
        reason: pause.reason ?? 'PAUSED',
        autoPaused: pause.reason === 'auto',
      }
    } catch (err) {
      console.warn('[hv] syncHvAlarms pause', err)
      return {
        ok: false,
        armed: 0,
        ids: [],
        reason: err instanceof Error ? err.message : 'SYNC_FAILED',
      }
    }
  }

  const wakes = buildArmedWakes({
    days: fresh.days,
    trajetMin: fresh.settings.trajetMin,
    prepMin: fresh.settings.prepMin,
    fromDateKey: today,
    maxArmed: HV_MAX_ARMED_ALARMS,
    now,
  })

  if (!isRankedAlarmPluginAvailable()) {
    if (wakes[0]) {
      saveSleepAlarmSettings({
        enabled: true,
        timeHm: wakes[0].wakeHm,
        days: [],
        alarmKitId: null,
      })
    }
    return { ok: false, armed: 0, ids: [], reason: 'ALARM_PLUGIN_MISSING' }
  }

  try {
    const perm = await RankedAlarm.requestPermissions()
    if (perm.alarms !== 'granted') {
      return { ok: false, armed: 0, ids: [], reason: 'PERMISSION_DENIED' }
    }

    await RankedAlarm.cancelAll()
    const ids = await armFixedWakes(wakes, soundName)

    saveHvState({ armedAlarmIds: ids })
    if (wakes[0]) {
      saveSleepAlarmSettings({
        enabled: ids.length > 0,
        timeHm: wakes[0].wakeHm,
        days: [],
        alarmKitId: ids[0] ?? null,
      })
    }
    return { ok: true, armed: ids.length, ids }
  } catch (err) {
    console.warn('[hv] syncHvAlarms', err)
    return {
      ok: false,
      armed: 0,
      ids: [],
      reason: err instanceof Error ? err.message : 'SYNC_FAILED',
    }
  }
}
