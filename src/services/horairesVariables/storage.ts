/**
 * Emploi du temps variable — local storage only (scoped per cloud user).
 * Schema Convex untouched.
 */

import { getActiveCloudUserId } from '../cloudSession'
import { readLocal, removeLocal, writeLocal } from '../secureLocalStore'
import {
  defaultCycleWeeks,
  defaultHvSettings,
  emptyDayPlan,
  sanitizeDecompressionMin,
  sanitizePrepMin,
  sanitizeSundayReminderHm,
  sanitizeTrajetMin,
  sanitizeWeekSlots,
  syncCycleSlots,
  type HvCycleLength,
  type HvCycleWeek,
  type HvDayPlan,
  type HvIsoWeekday,
  type HvSettings,
  type HvWeekTemplate,
} from '../../horaires-variables/engine'
import { HV_FEATURE_NAME } from '../../horaires-variables/constants'

export const HV_STORAGE_BASE = 'ranked-gym:horaires-variables'
export const HV_CHANGED_EVENT = 'ranked-gym:horaires-variables-changed'

export type HvState = {
  settings: HvSettings
  days: HvDayPlan[]
  /** AlarmKit ids currently armed for HV (fixed). */
  armedAlarmIds: string[]
  /** Display label kept for rename audits */
  featureName: typeof HV_FEATURE_NAME
}

function scopedKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${HV_STORAGE_BASE}:u:${uid}` : HV_STORAGE_BASE
}

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HV_CHANGED_EVENT))
  }
}

function sanitizeDay(raw: Partial<HvDayPlan> | null | undefined): HvDayPlan | null {
  if (!raw || typeof raw.dateKey !== 'string') return null
  const kind =
    raw.kind === 'tot' ||
    raw.kind === 'journee' ||
    raw.kind === 'soir' ||
    raw.kind === 'nuit' ||
    raw.kind === 'repos' ||
    raw.kind === 'unset'
      ? raw.kind
      : 'unset'
  return {
    dateKey: raw.dateKey,
    kind,
    startHm: typeof raw.startHm === 'string' ? raw.startHm : null,
    finishHm: typeof raw.finishHm === 'string' ? raw.finishHm : null,
    trajetMin:
      typeof raw.trajetMin === 'number' && Number.isFinite(raw.trajetMin)
        ? sanitizeTrajetMin(raw.trajetMin)
        : null,
    prepMin:
      typeof raw.prepMin === 'number' && Number.isFinite(raw.prepMin)
        ? sanitizePrepMin(raw.prepMin)
        : null,
    lastStartHm: typeof raw.lastStartHm === 'string' ? raw.lastStartHm : null,
    wakeOverrideHm: typeof raw.wakeOverrideHm === 'string' ? raw.wakeOverrideHm : null,
    softWake: Boolean(raw.softWake),
    softWakeHm: typeof raw.softWakeHm === 'string' ? raw.softWakeHm : '10:30',
    noAlarm: Boolean(raw.noAlarm),
    oneShotOffsetMin:
      typeof raw.oneShotOffsetMin === 'number' && Number.isFinite(raw.oneShotOffsetMin)
        ? Math.round(raw.oneShotOffsetMin)
        : 0,
    exception: Boolean(raw.exception),
  }
}

function sanitizeCycleWeeks(
  raw: unknown,
  length: HvCycleLength,
  fallbackA: HvSettings['weekASlots'],
  fallbackB: HvSettings['weekBSlots'],
): HvCycleWeek[] {
  const base = defaultCycleWeeks(length)
  if (!Array.isArray(raw) || raw.length === 0) {
    // Migrate from A/B slots
    const out = base.map((w, i) => ({
      ...w,
      slots: i === 0 ? fallbackA : i === 1 ? fallbackB : w.slots,
    }))
    return out
  }
  return base.map((w, i) => {
    const row = raw[i] as Partial<HvCycleWeek> | undefined
    const letter = (row?.letter as HvWeekTemplate) || w.letter
    const name = typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : w.name
    const slots = sanitizeWeekSlots(
      row?.slots,
      i === 0 ? fallbackA : i === 1 ? fallbackB : w.slots,
    )
    return { letter, name, slots }
  })
}

function sanitizeSettings(raw: Partial<HvSettings> | null | undefined): HvSettings {
  const base = defaultHvSettings()
  if (!raw) return base
  const weekASlots = sanitizeWeekSlots(raw.weekASlots, base.weekASlots)
  const weekBSlots = sanitizeWeekSlots(raw.weekBSlots, base.weekBSlots)
  let cycleLength: HvCycleLength = 1
  if (typeof raw.cycleLength === 'number' && raw.cycleLength >= 1 && raw.cycleLength <= 4) {
    cycleLength = Math.round(raw.cycleLength) as HvCycleLength
  } else if (raw.weeksAb) {
    cycleLength = 2
  }
  const cycleWeeks = sanitizeCycleWeeks(raw.cycleWeeks, cycleLength, weekASlots, weekBSlots)
  const reminderWeekday =
    typeof raw.reminderWeekday === 'number' &&
    raw.reminderWeekday >= 1 &&
    raw.reminderWeekday <= 7
      ? (Math.round(raw.reminderWeekday) as HvIsoWeekday)
      : 7
  const merged: HvSettings = {
    enabled: Boolean(raw.enabled),
    trajetMin: sanitizeTrajetMin(
      typeof raw.trajetMin === 'number' ? raw.trajetMin : base.trajetMin,
    ),
    prepMin: sanitizePrepMin(typeof raw.prepMin === 'number' ? raw.prepMin : base.prepMin),
    decompressionMin: sanitizeDecompressionMin(
      typeof raw.decompressionMin === 'number' ? raw.decompressionMin : base.decompressionMin,
    ),
    weeksAb: cycleLength >= 2,
    cycleLength,
    cycleWeeks,
    weekASlots: cycleWeeks[0]?.slots ?? weekASlots,
    weekBSlots: cycleWeeks[1]?.slots ?? weekBSlots,
    weekARefMondayKey:
      typeof raw.weekARefMondayKey === 'string' ? raw.weekARefMondayKey : base.weekARefMondayKey,
    reminderWeekday,
    sundayReminderHm: sanitizeSundayReminderHm(
      typeof raw.sundayReminderHm === 'string' ? raw.sundayReminderHm : base.sundayReminderHm,
    ),
    sundayReminderEnabled: raw.sundayReminderEnabled !== false,
    vacationPauseUntilKey:
      typeof raw.vacationPauseUntilKey === 'string' ? raw.vacationPauseUntilKey : null,
    autoPaused: Boolean(raw.autoPaused),
    autoPauseCardDismissed: Boolean(raw.autoPauseCardDismissed),
    lastStartEditAt: typeof raw.lastStartEditAt === 'string' ? raw.lastStartEditAt : null,
    activatedAt: typeof raw.activatedAt === 'string' ? raw.activatedAt : null,
    pauseSimpleWakeHm:
      typeof raw.pauseSimpleWakeHm === 'string' ? raw.pauseSimpleWakeHm : base.pauseSimpleWakeHm,
  }
  return syncCycleSlots(merged)
}

export function defaultHvState(): HvState {
  return {
    settings: defaultHvSettings(),
    days: [],
    armedAlarmIds: [],
    featureName: HV_FEATURE_NAME,
  }
}

export function getHvState(): HvState {
  const fallback = defaultHvState()
  try {
    const raw = readLocal(scopedKey())
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<HvState>
    const days = Array.isArray(parsed.days)
      ? parsed.days.map(sanitizeDay).filter((d): d is HvDayPlan => d != null)
      : []
    const armedAlarmIds = Array.isArray(parsed.armedAlarmIds)
      ? parsed.armedAlarmIds.filter((id): id is string => typeof id === 'string')
      : []
    return {
      settings: sanitizeSettings(parsed.settings),
      days,
      armedAlarmIds,
      featureName: HV_FEATURE_NAME,
    }
  } catch {
    return fallback
  }
}

export function saveHvState(patch: Partial<HvState>): HvState {
  const cur = getHvState()
  const next: HvState = {
    settings: patch.settings ? sanitizeSettings({ ...cur.settings, ...patch.settings }) : cur.settings,
    days: patch.days
      ? patch.days.map(sanitizeDay).filter((d): d is HvDayPlan => d != null)
      : cur.days,
    armedAlarmIds: patch.armedAlarmIds ?? cur.armedAlarmIds,
    featureName: HV_FEATURE_NAME,
  }
  writeLocal(scopedKey(), JSON.stringify(next))
  notify()
  return next
}

export function clearHvState(): void {
  removeLocal(scopedKey())
  notify()
}

export function upsertHvDay(day: HvDayPlan): HvState {
  const cur = getHvState()
  const days = cur.days.filter((d) => d.dateKey !== day.dateKey)
  days.push(sanitizeDay(day) ?? emptyDayPlan(day.dateKey))
  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const settings = { ...cur.settings }
  if (day.startHm) {
    settings.lastStartEditAt = new Date().toISOString()
    settings.autoPaused = false
  }
  return saveHvState({ days, settings })
}

export function isHvModeActive(): boolean {
  const { settings } = getHvState()
  return settings.enabled
}
