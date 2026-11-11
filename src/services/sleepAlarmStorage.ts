/**
 * Réglages réveil Sommeil — locaux uniquement (effacés avec le compte).
 * Aucun point / score / Pro. Aucune notif hors réveil.
 */

import { getActiveCloudUserId } from './cloudSession'
import { readLocal, removeLocal, writeLocal } from './secureLocalStore'
import { getSleepSchedule } from './sleepStorage'

export const SLEEP_ALARM_STORAGE_BASE = 'ranked-gym:sleep-alarm'
export const SLEEP_ALARM_CHANGED_EVENT = 'ranked-gym:sleep-alarm-changed'

export const SLEEP_ALARM_SOUND_ID = 'rugissement_ranked_gym' as const
export const SLEEP_ALARM_SOUND_LABEL = 'Rugissement Ranked Gym'
export const SLEEP_ALARM_SOUND_FILE = 'RugissementRankedGym'
export const SLEEP_ALARM_SNOOZE_MINUTES = 9

/** ISO weekday: 1=lundi … 7=dimanche (aligné UX FR). */
export type SleepAlarmWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type SleepAlarmSoundId = typeof SLEEP_ALARM_SOUND_ID | 'none'

export interface SleepAlarmSettings {
  enabled: boolean
  /** HH:MM — défaut = lever du cadran */
  timeHm: string
  /** Jours cochés (1=lun … 7=dim). Vide = une seule fois à la prochaine occurrence. */
  days: SleepAlarmWeekday[]
  label: string
  soundId: SleepAlarmSoundId
  snoozeEnabled: boolean
  snoozeMinutes: number
  /** Id AlarmKit (iOS 26+) si programmé. */
  alarmKitId: string | null
}

const DEFAULT_WEEKDAYS: SleepAlarmWeekday[] = [1, 2, 3, 4, 5]

function scopedKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${SLEEP_ALARM_STORAGE_BASE}:u:${uid}` : SLEEP_ALARM_STORAGE_BASE
}

function notifyChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SLEEP_ALARM_CHANGED_EVENT))
  }
}

function normalizeTimeHm(raw: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function sanitizeDays(raw: unknown): SleepAlarmWeekday[] {
  if (!Array.isArray(raw)) return [...DEFAULT_WEEKDAYS]
  const out: SleepAlarmWeekday[] = []
  for (const d of raw) {
    const n = typeof d === 'number' ? d : Number(d)
    if (n >= 1 && n <= 7 && !out.includes(n as SleepAlarmWeekday)) {
      out.push(n as SleepAlarmWeekday)
    }
  }
  return out.sort((a, b) => a - b)
}

export function defaultSleepAlarmSettings(): SleepAlarmSettings {
  const schedule = getSleepSchedule()
  return {
    enabled: false,
    timeHm: schedule?.waketime ?? '07:00',
    days: [...DEFAULT_WEEKDAYS],
    label: 'Lever',
    soundId: SLEEP_ALARM_SOUND_ID,
    snoozeEnabled: true,
    snoozeMinutes: SLEEP_ALARM_SNOOZE_MINUTES,
    alarmKitId: null,
  }
}

export function getSleepAlarmSettings(): SleepAlarmSettings {
  const fallback = defaultSleepAlarmSettings()
  try {
    const raw = readLocal(scopedKey())
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SleepAlarmSettings>
    const timeHm = typeof parsed.timeHm === 'string' ? normalizeTimeHm(parsed.timeHm) : null
    return {
      enabled: Boolean(parsed.enabled),
      timeHm: timeHm ?? fallback.timeHm,
      days: sanitizeDays(parsed.days),
      label:
        typeof parsed.label === 'string' && parsed.label.trim()
          ? parsed.label.trim().slice(0, 40)
          : fallback.label,
      soundId: parsed.soundId === 'none' ? 'none' : SLEEP_ALARM_SOUND_ID,
      snoozeEnabled: parsed.snoozeEnabled !== false,
      snoozeMinutes:
        typeof parsed.snoozeMinutes === 'number' && parsed.snoozeMinutes > 0
          ? Math.min(30, Math.round(parsed.snoozeMinutes))
          : SLEEP_ALARM_SNOOZE_MINUTES,
      alarmKitId: typeof parsed.alarmKitId === 'string' ? parsed.alarmKitId : null,
    }
  } catch {
    return fallback
  }
}

export function saveSleepAlarmSettings(
  patch: Partial<SleepAlarmSettings>,
): SleepAlarmSettings {
  const current = getSleepAlarmSettings()
  const next: SleepAlarmSettings = {
    ...current,
    ...patch,
  }
  if (typeof patch.timeHm === 'string') {
    next.timeHm = normalizeTimeHm(patch.timeHm) ?? current.timeHm
  }
  if (patch.days) next.days = sanitizeDays(patch.days)
  if (typeof patch.label === 'string') {
    next.label = patch.label.trim().slice(0, 40) || 'Lever'
  }
  writeLocal(scopedKey(), JSON.stringify(next))
  notifyChanged()
  return next
}

export function clearSleepAlarmSettings(): void {
  removeLocal(scopedKey())
  notifyChanged()
}

export function parseAlarmTimeHm(timeHm: string): { hour: number; minute: number } | null {
  const normalized = normalizeTimeHm(timeHm)
  if (!normalized) return null
  const [h, m] = normalized.split(':').map(Number)
  return { hour: h, minute: m }
}
