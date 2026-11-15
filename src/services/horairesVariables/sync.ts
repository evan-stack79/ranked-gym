/**
 * Sync HV planning → AlarmKit fixed alarms (≤ HV_MAX_ARMED_ALARMS).
 * Does not alter classic createAlarm make-before-break path when HV is off.
 */

import {
  buildArmedWakes,
  dateKeyOf,
  isHvPaused,
  parseHm,
  shouldAutoPause,
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

/**
 * When HV is active and not paused: cancelAll then arm up to 14 fixed alarms.
 * Classic single-alarm createAlarm is not used (preserves e1a8801 for non-HV).
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
      armedAlarmIds: [],
    })
    if (isRankedAlarmPluginAvailable()) {
      try {
        await RankedAlarm.cancelAll()
      } catch {
        /* ignore */
      }
    }
    saveSleepAlarmSettings({ enabled: false, alarmKitId: null })
    return { ok: true, armed: 0, ids: [], reason: 'AUTO_PAUSE', autoPaused: true }
  }

  const pause = isHvPaused(state.settings, today)
  if (pause.paused) {
    if (isRankedAlarmPluginAvailable()) {
      try {
        await RankedAlarm.cancelAll()
      } catch {
        /* ignore */
      }
    }
    saveHvState({ armedAlarmIds: [] })
    saveSleepAlarmSettings({ enabled: false, alarmKitId: null })
    return { ok: true, armed: 0, ids: [], reason: pause.reason ?? 'PAUSED' }
  }

  const wakes = buildArmedWakes({
    days: state.days,
    trajetMin: state.settings.trajetMin,
    prepMin: state.settings.prepMin,
    fromDateKey: today,
    maxArmed: HV_MAX_ARMED_ALARMS,
  })

  if (!isRankedAlarmPluginAvailable()) {
    // Still mark classic settings with next wake for UI consistency.
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

    // Wipe previous set then arm fixed one-shots (état 29 A).
    await RankedAlarm.cancelAll()

    const ids: string[] = []
    const soundName =
      getSleepAlarmSettings().soundId === 'none' ? undefined : SLEEP_ALARM_SOUND_FILE

    for (const w of wakes) {
      const fireAt = fireDateFor(w.dateKey, w.wakeHm)
      if (!fireAt) continue
      if (typeof RankedAlarm.createFixedAlarm !== 'function') {
        // Fallback: only next relative never via classic createAlarm (limit 1).
        const first = wakes[0]
        if (!first) break
        const parsed = parseHm(first.wakeHm)
        if (!parsed) break
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
        label: `Réveil ${w.dateKey}`,
        snoozeEnabled: true,
        snoozeMinutes: 9,
        soundName,
      })
      if (r.id) ids.push(r.id)
      if (ids.length >= HV_MAX_ARMED_ALARMS) break
    }

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
