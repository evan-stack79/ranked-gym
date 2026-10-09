/**
 * Rappel repos — après 2 jours consécutifs avec séance (Europe/Paris),
 * au plus une fois par semaine, dismissible, désactivable.
 * Texte exact validé §10.
 */

import {
  areConsecutiveDateKeys,
  parisDateKey,
  parisWeekKey,
  shiftDateKey,
} from '../utils/parisDate'

export const REST_REMINDER_TEXT =
  "Le repos fait aussi partie de l'entraînement. Écoute ton corps." as const

export type RestReminderPrefs = {
  /** false = utilisateur a coupé le rappel (réglages). */
  enabled: boolean
  updatedAt: number
  /** Semaine (lundi Paris) où le bandeau a été vu / dismiss. */
  dismissedWeekKey?: string | null
}

export const DEFAULT_REST_REMINDER_PREFS: RestReminderPrefs = {
  enabled: true,
  updatedAt: 0,
  dismissedWeekKey: null,
}

export function parseRestReminderPrefs(raw: unknown): RestReminderPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_REST_REMINDER_PREFS }
  const r = raw as Partial<RestReminderPrefs>
  return {
    enabled: r.enabled !== false,
    updatedAt:
      typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
    dismissedWeekKey:
      typeof r.dismissedWeekKey === 'string' && r.dismissedWeekKey
        ? r.dismissedWeekKey
        : null,
  }
}

export function mergeRestReminderPrefs(
  local: RestReminderPrefs | null | undefined,
  remote: RestReminderPrefs | null | undefined,
): RestReminderPrefs {
  const l = parseRestReminderPrefs(local)
  const r = parseRestReminderPrefs(remote)
  if (!local && !remote) return { ...DEFAULT_REST_REMINDER_PREFS }
  if (!local) return r
  if (!remote) return l
  return l.updatedAt >= r.updatedAt ? l : r
}

/** Unique dateKeys (Paris) ayant au moins une séance, triés croissant. */
export function sessionParisDateKeys(
  notes: Array<{ dateKey?: string; createdAt?: number; updatedAt?: number }>,
): string[] {
  const set = new Set<string>()
  for (const n of notes) {
    if (typeof n.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.dateKey)) {
      set.add(n.dateKey)
      continue
    }
    const ts =
      typeof n.createdAt === 'number' && n.createdAt > 0
        ? n.createdAt
        : typeof n.updatedAt === 'number' && n.updatedAt > 0
          ? n.updatedAt
          : null
    if (ts != null) set.add(parisDateKey(ts))
  }
  return [...set].sort()
}

/**
 * true s’il existe deux jours consécutifs (Paris) avec séance.
 * On regarde la paire la plus récente se terminant ≤ aujourd’hui.
 */
export function hasTwoConsecutiveSessionDays(
  notes: Array<{ dateKey?: string; createdAt?: number; updatedAt?: number }>,
  now: Date | number = new Date(),
): boolean {
  const keys = sessionParisDateKeys(notes)
  if (keys.length < 2) return false
  const today = parisDateKey(now)
  for (let i = keys.length - 1; i >= 1; i -= 1) {
    const later = keys[i]!
    const earlier = keys[i - 1]!
    if (later > today) continue
    if (areConsecutiveDateKeys(earlier, later)) return true
  }
  return false
}

export function shouldShowRestReminder(
  notes: Array<{ dateKey?: string; createdAt?: number; updatedAt?: number }>,
  prefs: RestReminderPrefs | null | undefined,
  now: Date | number = new Date(),
): boolean {
  const p = parseRestReminderPrefs(prefs)
  if (!p.enabled) return false
  const week = parisWeekKey(now)
  if (p.dismissedWeekKey === week) return false
  return hasTwoConsecutiveSessionDays(notes, now)
}

export function dismissRestReminderForCurrentWeek(
  prefs: RestReminderPrefs | null | undefined,
  now: Date | number = new Date(),
): RestReminderPrefs {
  const p = parseRestReminderPrefs(prefs)
  return {
    ...p,
    dismissedWeekKey: parisWeekKey(now),
    updatedAt: Date.now(),
  }
}

export function setRestReminderEnabled(
  prefs: RestReminderPrefs | null | undefined,
  enabled: boolean,
): RestReminderPrefs {
  const p = parseRestReminderPrefs(prefs)
  return {
    ...p,
    enabled,
    updatedAt: Date.now(),
  }
}

/** Exposé pour tests — vérifie la paire j / j+1. */
export function consecutivePairExists(keys: string[]): boolean {
  const sorted = [...keys].sort()
  for (let i = 1; i < sorted.length; i += 1) {
    if (shiftDateKey(sorted[i - 1]!, 1) === sorted[i]) return true
  }
  return false
}
