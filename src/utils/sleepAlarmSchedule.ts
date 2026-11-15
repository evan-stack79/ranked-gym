/**
 * Pure scheduling helpers for the Sommeil réveil.
 * No I/O — unit-tested.
 */

import type { SleepAlarmWeekday } from '../services/sleepAlarmStorage'
import { SLEEP_ALARM_SNOOZE_MINUTES } from '../services/sleepAlarmStorage'

/** Roll to the next day when the candidate is less than this many seconds away. */
export const SLEEP_ALARM_MIN_LEAD_SECONDS = 5

/** Capacitor / iOS LocalNotifications: Sunday = 1 … Saturday = 7 */
export function toIosWeekday(day: SleepAlarmWeekday): number {
  return day === 7 ? 1 : day + 1
}

/** AlarmKit / Locale.Weekday string used by the Capacitor Alarm plugin. */
export function toAlarmKitWeekday(day: SleepAlarmWeekday): string {
  switch (day) {
    case 1:
      return 'MONDAY'
    case 2:
      return 'TUESDAY'
    case 3:
      return 'WEDNESDAY'
    case 4:
      return 'THURSDAY'
    case 5:
      return 'FRIDAY'
    case 6:
      return 'SATURDAY'
    case 7:
      return 'SUNDAY'
    default:
      return 'MONDAY'
  }
}

export function formatRepeatSummary(days: SleepAlarmWeekday[]): string {
  if (days.length === 0) return 'Une fois'
  const sorted = [...days].sort((a, b) => a - b)
  const isWeekdays =
    sorted.length === 5 && sorted.every((d, i) => d === ([1, 2, 3, 4, 5] as const)[i])
  if (isWeekdays) return 'En semaine'
  const isWeekend = sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7
  if (isWeekend) return 'Week-end'
  if (sorted.length === 7) return 'Tous les jours'
  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  return sorted.map((d) => labels[d - 1]).join(', ')
}

export type AlarmBackend = 'alarmkit' | 'local-notification' | 'unavailable'

/**
 * Choose backend: AlarmKit on iOS 26+, local notification on older iOS,
 * unavailable on web/android (feature hidden).
 */
export function chooseAlarmBackend(input: {
  platform: string
  /** Major iOS version when platform === 'ios'; null if unknown. */
  iosMajor: number | null
  alarmKitAvailable: boolean
}): AlarmBackend {
  if (input.platform !== 'ios') return 'unavailable'
  if (input.alarmKitAvailable || (input.iosMajor != null && input.iosMajor >= 26)) {
    return 'alarmkit'
  }
  return 'local-notification'
}

/**
 * Next one-shot wall-clock occurrence of hour:minute.
 * If the candidate is less than {@link SLEEP_ALARM_MIN_LEAD_SECONDS} away, roll to the next day.
 * Used for « Dormir maintenant » / AlarmKit `.relative(.never)` display.
 */
export function nextOneShotAlarmDate(
  hour: number,
  minute: number,
  now = new Date(),
): Date {
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setMilliseconds(0)
  candidate.setHours(hour, minute, 0, 0)
  const leadMs = SLEEP_ALARM_MIN_LEAD_SECONDS * 1000
  if (candidate.getTime() - now.getTime() < leadMs) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate
}

/** Next Date for hour:minute on selected weekdays (or one-shot). */
export function nextAlarmDate(
  hour: number,
  minute: number,
  days: SleepAlarmWeekday[],
  now = new Date(),
): Date {
  if (days.length === 0) {
    return nextOneShotAlarmDate(hour, minute, now)
  }

  const wanted = new Set(days)
  const leadMs = SLEEP_ALARM_MIN_LEAD_SECONDS * 1000
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now)
    d.setDate(now.getDate() + offset)
    d.setHours(hour, minute, 0, 0)
    d.setSeconds(0, 0)
    d.setMilliseconds(0)
    // JS: 0=Sun … 6=Sat → SleepAlarmWeekday 7=Sun, 1=Mon…
    const js = d.getDay()
    const our = (js === 0 ? 7 : js) as SleepAlarmWeekday
    if (!wanted.has(our)) continue
    if (d.getTime() - now.getTime() >= leadMs) return d
  }
  // fallback tomorrow
  const fallback = new Date(now)
  fallback.setDate(now.getDate() + 1)
  fallback.setHours(hour, minute, 0, 0)
  return fallback
}

const FR_DAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const

/** « lundi 07:00 · dans 7 h 05 » — AlarmKit read-back line. */
export function formatAlarmReadback(fireAt: Date, now = new Date()): string {
  const day = FR_DAYS[fireAt.getDay()] ?? 'jour'
  const hm = `${String(fireAt.getHours()).padStart(2, '0')}:${String(fireAt.getMinutes()).padStart(2, '0')}`
  const totalMin = Math.max(0, Math.round((fireAt.getTime() - now.getTime()) / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const dans =
    h > 0 ? `dans ${h} h ${String(m).padStart(2, '0')}` : `dans ${m} min`
  return `${day} ${hm} · ${dans}`
}

export function snoozeFrom(
  from: Date,
  minutes = SLEEP_ALARM_SNOOZE_MINUTES,
): Date {
  return new Date(from.getTime() + Math.max(1, minutes) * 60_000)
}

/** Stable local-notification ids for weekly slots (7201–7207) + snooze (7208). */
export const SLEEP_ALARM_NOTIF_IDS = {
  byIosWeekday: (iosWeekday: number) => 7200 + iosWeekday, // 7201..7207
  snooze: 7208,
  once: 7209,
} as const

export const SLEEP_ALARM_NOTIF_ACTION_TYPE = 'SLEEP_ALARM_ACTIONS'
export const SLEEP_ALARM_SNOOZE_ACTION_ID = 'SLEEP_ALARM_SNOOZE'
export const SLEEP_ALARM_STOP_ACTION_ID = 'SLEEP_ALARM_STOP'
