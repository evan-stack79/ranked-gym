/**
 * Sync HV planning → AlarmKit fixed alarms (≤ HV_MAX_ARMED_ALARMS).
 * Make-before-break: create + verify new fixed alarms first, then cancel known old ids.
 * Does not alter classic createAlarm make-before-break path when HV is off / pause simple.
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
  /** Expected wake keys (dateKeyTwakeHm) missing after relecture */
  missing?: string[]
  lastError?: string | null
  superseded?: boolean
}

export type HvWakeTarget = { dateKey: string; wakeHm: string }

/** Signature of desired wake list — used to skip no-op re-syncs (stops SleepView loop). */
export function wakesSignature(wakes: HvWakeTarget[]): string {
  return wakes.map((w) => `${w.dateKey}T${w.wakeHm}`).join('|')
}

let hvSyncLastError: string | null = null
let lastOkSignature: string | null = null
let lastOkIds: string[] = []

let syncGate: Promise<void> = Promise.resolve()
let pendingMerge = false
let lastHvSyncResult: HvSyncResult = { ok: true, armed: 0, ids: [] }

/** @internal — reset between unit tests. */
export function __resetHvSyncGateForTests(): void {
  syncGate = Promise.resolve()
  pendingMerge = false
  lastHvSyncResult = { ok: true, armed: 0, ids: [] }
  lastOkSignature = null
  lastOkIds = []
  hvSyncLastError = null
}

export function getHvSyncLastError(): string | null {
  return hvSyncLastError
}

function setHvSyncLastError(msg: string | null): void {
  hvSyncLastError = msg
}

function fireDateFor(dateKey: string, wakeHm: string, nowMs = Date.now()): Date | null {
  const p = parseHm(wakeHm)
  if (!p) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, p.hour, p.minute, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getTime() <= nowMs + 5_000) return null
  return dt
}

async function cancelKnownIds(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!id) continue
    try {
      await RankedAlarm.cancelAlarm({ id })
    } catch {
      /* keep going — best effort */
    }
  }
}

/**
 * Create fixed wakes one-by-one. On any failure, cancel the new ids already created
 * and rethrow — callers keep their previous alarms.
 */
async function armFixedWakes(
  wakes: HvWakeTarget[],
  soundName: string | undefined,
  nowMs = Date.now(),
): Promise<string[]> {
  const ids: string[] = []
  try {
    for (const w of wakes) {
      const fireAt = fireDateFor(w.dateKey, w.wakeHm, nowMs)
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
        if (!r.id) throw new Error('CREATE_ALARM_FAILED')
        ids.push(r.id)
        break
      }
      const r = await RankedAlarm.createFixedAlarm({
        fireAtMs: fireAt.getTime(),
        label: 'Réveil',
        snoozeEnabled: true,
        snoozeMinutes: 9,
        soundName,
      })
      if (!r.id) throw new Error('CREATE_FIXED_FAILED')
      ids.push(r.id)
      if (ids.length >= HV_MAX_ARMED_ALARMS) break
    }
    return ids
  } catch (err) {
    await cancelKnownIds(ids)
    throw err
  }
}

async function verifyArmedIds(ids: string[]): Promise<{ ok: boolean; missing: string[] }> {
  if (ids.length === 0) return { ok: true, missing: [] }
  const { alarms } = await RankedAlarm.getAlarms()
  const present = new Set(alarms.map((a) => a.id))
  const missing = ids.filter((id) => !present.has(id))
  return { ok: missing.length === 0, missing }
}

function knownOldIds(stateIds: string[]): string[] {
  const simpleId = getSleepAlarmSettings().alarmKitId
  const all = [...stateIds]
  if (simpleId) all.push(simpleId)
  return [...new Set(all.filter(Boolean))]
}

/**
 * Planning OFF: cancel known HV armed ids, re-arm classic single réveil
 * via createAlarm (native make-before-break e1a8801), clear armedAlarmIds.
 */
export async function teardownHvAlarmsRestoreSimple(): Promise<HvSyncResult> {
  const state = getHvState()
  const hvIds = [...state.armedAlarmIds]
  // Cancel HV fixed wakes first (do not touch classic make-before-break ordering).
  await cancelKnownIds(hvIds)

  const settings = getSleepAlarmSettings()
  const soundName = settings.soundId === 'none' ? undefined : SLEEP_ALARM_SOUND_FILE
  let simpleId: string | null = null

  if (isRankedAlarmPluginAvailable() && settings.enabled) {
    const parsed = parseHm(settings.timeHm)
    if (parsed) {
      try {
        const perm = await RankedAlarm.requestPermissions()
        if (perm.alarms === 'granted') {
          // Classic createAlarm — native verify then cancelAll(except new). Unchanged path.
          const r = await RankedAlarm.createAlarm({
            hour: parsed.hour,
            minute: parsed.minute,
            label: 'Réveil',
            snoozeEnabled: true,
            snoozeMinutes: 9,
            soundName,
          })
          if (r.id) {
            simpleId = r.id
            saveSleepAlarmSettings({
              enabled: true,
              timeHm: settings.timeHm,
              days: [],
              alarmKitId: r.id,
            })
          }
        }
      } catch (err) {
        console.warn('[hv] restore simple after OFF', err)
      }
    }
  }

  // Drop any leftover HV ids that createAlarm did not sweep (best effort).
  if (hvIds.length > 0) {
    await cancelKnownIds(hvIds.filter((id) => id && id !== simpleId))
  }

  saveHvState({ armedAlarmIds: [] })
  lastOkSignature = 'OFF'
  lastOkIds = simpleId ? [simpleId] : []
  setHvSyncLastError(null)
  return {
    ok: true,
    armed: simpleId ? 1 : 0,
    ids: simpleId ? [simpleId] : [],
    reason: 'OFF',
    lastError: null,
  }
}

async function syncHvAlarmsBody(now: Date): Promise<HvSyncResult> {
  const state = getHvState()
  const today = dateKeyOf(now)
  const nowMs = now.getTime()

  if (!state.settings.enabled) {
    // Always tear down leftover HV fixed alarms when planning is off.
    return teardownHvAlarmsRestoreSimple()
  }

  const hasAnyStart = state.days.some((d) => Boolean(d.startHm))
  if (shouldAutoPause({ settings: state.settings, hasAnyStart, now })) {
    saveHvState({
      settings: { ...state.settings, autoPaused: true, autoPauseCardDismissed: false },
    })
  }

  const fresh = getHvState()
  const pause = isHvPaused(fresh.settings, today)

  const soundName =
    getSleepAlarmSettings().soundId === 'none' ? undefined : SLEEP_ALARM_SOUND_FILE

  if (pause.paused) {
    const simpleHm =
      fresh.settings.pauseSimpleWakeHm ||
      getSleepAlarmSettings().timeHm ||
      '07:30'
    const resumeKey =
      pause.reason === 'vacation' && fresh.settings.vacationPauseUntilKey
        ? vacationResumeKey(fresh.settings.vacationPauseUntilKey)
        : pause.reason === 'auto'
          ? today
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

    const simpleParsed = parseHm(simpleHm)
    const pauseSig = `pause:${pause.reason}:${simpleHm}|${wakesSignature(planningWakes)}`
    if (
      lastOkSignature === pauseSig &&
      lastOkIds.length > 0 &&
      (await verifyArmedIds(lastOkIds)).ok
    ) {
      return { ok: true, armed: lastOkIds.length, ids: lastOkIds, reason: pause.reason ?? 'PAUSED' }
    }

    saveSleepAlarmSettings({
      enabled: true,
      timeHm: simpleHm,
      days: [],
      alarmKitId: getSleepAlarmSettings().alarmKitId,
    })

    if (!isRankedAlarmPluginAvailable()) {
      const err = 'ALARM_PLUGIN_MISSING'
      setHvSyncLastError(err)
      return { ok: false, armed: 0, ids: [], reason: err, lastError: err }
    }

    const oldIds = knownOldIds(fresh.armedAlarmIds)

    try {
      const perm = await RankedAlarm.requestPermissions()
      if (perm.alarms !== 'granted') {
        const err = 'PERMISSION_DENIED'
        setHvSyncLastError(err)
        return { ok: false, armed: oldIds.length, ids: oldIds, reason: err, lastError: err }
      }

      // Simple réveil via createAlarm (e1a8801 native make-before-break) — do NOT cancelAll first.
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
        if (!r.id) throw new Error('CREATE_ALARM_FAILED')
        ids.push(r.id)
        saveSleepAlarmSettings({
          enabled: true,
          timeHm: simpleHm,
          days: [],
          alarmKitId: r.id,
        })
      }

      const remaining = HV_MAX_ARMED_ALARMS - ids.length
      if (remaining > 0 && planningWakes.length > 0) {
        const more = await armFixedWakes(planningWakes.slice(0, remaining), soundName, nowMs)
        ids.push(...more)
      }

      const verified = await verifyArmedIds(ids)
      if (!verified.ok) {
        await cancelKnownIds(ids.filter((id) => !oldIds.includes(id)))
        const err = `MISSING_AFTER_SYNC:${verified.missing.join(',')}`
        setHvSyncLastError(err)
        return {
          ok: false,
          armed: oldIds.length,
          ids: oldIds,
          reason: 'MISSING_AFTER_SYNC',
          missing: verified.missing,
          lastError: err,
        }
      }

      const newSet = new Set(ids)
      await cancelKnownIds(oldIds.filter((id) => !newSet.has(id)))

      saveHvState({ armedAlarmIds: ids })
      lastOkSignature = pauseSig
      lastOkIds = ids
      setHvSyncLastError(null)
      return {
        ok: true,
        armed: ids.length,
        ids,
        reason: pause.reason ?? 'PAUSED',
        autoPaused: pause.reason === 'auto',
        lastError: null,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SYNC_FAILED'
      console.warn('[hv] syncHvAlarms pause', err)
      setHvSyncLastError(msg)
      return {
        ok: false,
        armed: oldIds.length,
        ids: oldIds,
        reason: msg,
        lastError: msg,
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
  const sig = wakesSignature(wakes)

  if (!isRankedAlarmPluginAvailable()) {
    if (wakes[0]) {
      saveSleepAlarmSettings({
        enabled: true,
        timeHm: wakes[0].wakeHm,
        days: [],
        alarmKitId: getSleepAlarmSettings().alarmKitId,
      })
    }
    const err = 'ALARM_PLUGIN_MISSING'
    setHvSyncLastError(err)
    return { ok: false, armed: 0, ids: [], reason: err, lastError: err }
  }

  if (
    lastOkSignature === sig &&
    lastOkIds.length === wakes.length &&
    (await verifyArmedIds(lastOkIds)).ok
  ) {
    return { ok: true, armed: lastOkIds.length, ids: lastOkIds, lastError: null }
  }

  const oldIds = knownOldIds(fresh.armedAlarmIds)

  try {
    const perm = await RankedAlarm.requestPermissions()
    if (perm.alarms !== 'granted') {
      const err = 'PERMISSION_DENIED'
      setHvSyncLastError(err)
      return { ok: false, armed: oldIds.length, ids: oldIds, reason: err, lastError: err }
    }

    // Make-before-break: create all new first (no cancelAll).
    const ids = await armFixedWakes(wakes, soundName, nowMs)

    const expectedKeys = wakes
      .map((w) => {
        const fire = fireDateFor(w.dateKey, w.wakeHm, nowMs)
        return fire ? `${w.dateKey}T${w.wakeHm}` : null
      })
      .filter((k): k is string => Boolean(k))
      .slice(0, HV_MAX_ARMED_ALARMS)

    if (ids.length < expectedKeys.length) {
      await cancelKnownIds(ids)
      const missing = expectedKeys.slice(ids.length)
      const err = `CREATE_INCOMPLETE:${missing.join(',')}`
      setHvSyncLastError(err)
      return {
        ok: false,
        armed: oldIds.length,
        ids: oldIds,
        reason: 'CREATE_INCOMPLETE',
        missing,
        lastError: err,
      }
    }

    const verified = await verifyArmedIds(ids)
    if (!verified.ok) {
      await cancelKnownIds(ids)
      const missingKeys = verified.missing.map(
        (id) => expectedKeys[ids.indexOf(id)] ?? id,
      )
      const err = `MISSING_AFTER_SYNC:${missingKeys.join(',')}`
      setHvSyncLastError(err)
      return {
        ok: false,
        armed: oldIds.length,
        ids: oldIds,
        reason: 'MISSING_AFTER_SYNC',
        missing: missingKeys,
        lastError: err,
      }
    }

    // Success — cancel only known old ids (never the new ones).
    const newSet = new Set(ids)
    await cancelKnownIds(oldIds.filter((id) => !newSet.has(id)))

    saveHvState({ armedAlarmIds: ids })
    if (wakes[0]) {
      saveSleepAlarmSettings({
        enabled: ids.length > 0,
        timeHm: wakes[0].wakeHm,
        days: [],
        alarmKitId: ids[0] ?? null,
      })
    }

    lastOkSignature = sig
    lastOkIds = ids
    setHvSyncLastError(null)
    return { ok: true, armed: ids.length, ids, lastError: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SYNC_FAILED'
    console.warn('[hv] syncHvAlarms', err)
    setHvSyncLastError(msg)
    return {
      ok: false,
      armed: oldIds.length,
      ids: oldIds,
      reason: msg,
      lastError: msg,
    }
  }
}

/**
 * Serialize HV syncs: one at a time; requests arriving mid-flight coalesce into
 * a single rerun after the current body finishes.
 */
export async function syncHvAlarms(now = new Date()): Promise<HvSyncResult> {
  pendingMerge = true
  const prev = syncGate
  let release!: () => void
  syncGate = new Promise<void>((r) => {
    release = r
  })
  await prev
  try {
    if (!pendingMerge) {
      return { ...lastHvSyncResult, superseded: true }
    }
    let result: HvSyncResult = lastHvSyncResult
    while (pendingMerge) {
      pendingMerge = false
      result = await syncHvAlarmsBody(now)
    }
    lastHvSyncResult = result
    return result
  } finally {
    release()
  }
}
