/**
 * Persistence locale des nuits — indépendant du Sleep Engine et de Nutrition.
 * Aucune donnée inventée : uniquement ce que l’utilisateur enregistre.
 */

import { getActiveCloudUserId } from './cloudSession'

const LOG_BASE = 'ranked-gym:sleep-log'

export const SLEEP_CHANGED_EVENT = 'ranked-gym:sleep-changed'

export interface SleepNightEntry {
  id: string
  /** Date calendaire du lever (matin) YYYY-MM-DD. */
  dateKey: string
  /** HH:MM */
  bedtime: string
  /** HH:MM */
  waketime: string
  /** Total Sleep Time (heures). */
  tstHours: number
  createdAt: string
}

export type SleepStorageSaveOptions = { skipCloud?: boolean }

function scopedKey(base: string): string {
  const uid = getActiveCloudUserId()
  return uid ? `${base}:u:${uid}` : base
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function notifySleepChanged(options?: SleepStorageSaveOptions) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SLEEP_CHANGED_EVENT))
  }
  if (!options?.skipCloud) {
    void import('./cloudBackup').then((m) => m.notifyLocalDataChanged()).catch(() => {})
  }
}

function asFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeTimeHm(raw: string): string | null {
  const trimmed = raw.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function todayDateKey(now = new Date()): string {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function normalizeSleepNightEntry(
  input: Omit<SleepNightEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): SleepNightEntry | null {
  const bedtime = normalizeTimeHm(input.bedtime)
  const waketime = normalizeTimeHm(input.waketime)
  const tstHours = asFiniteNumber(input.tstHours, NaN)
  const dateKey = typeof input.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)
    ? input.dateKey
    : null

  if (!bedtime || !waketime || !dateKey) return null
  if (!Number.isFinite(tstHours) || tstHours < 0 || tstHours > 24) return null

  return {
    id: input.id ?? `sleep-${dateKey}-${Date.now()}`,
    dateKey,
    bedtime,
    waketime,
    tstHours,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

export function getSleepLog(): SleepNightEntry[] {
  const raw = readJson<SleepNightEntry[]>(scopedKey(LOG_BASE), [])
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => normalizeSleepNightEntry(entry))
    .filter((e): e is SleepNightEntry => e != null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt))
}

export function getLatestSleepNight(): SleepNightEntry | null {
  return getSleepLog()[0] ?? null
}

/** Fenêtre glissante des N nuits les plus récentes (défaut 7). */
export function getRecentSleepNights(limit = 7): SleepNightEntry[] {
  return getSleepLog().slice(0, Math.max(0, limit))
}

export function saveSleepNight(
  input: {
    bedtime: string
    waketime: string
    tstHours: number
    dateKey?: string
  },
  options?: SleepStorageSaveOptions,
): SleepNightEntry | null {
  const entry = normalizeSleepNightEntry({
    dateKey: input.dateKey ?? todayDateKey(),
    bedtime: input.bedtime,
    waketime: input.waketime,
    tstHours: input.tstHours,
  })
  if (!entry) return null

  const log = getSleepLog().filter((n) => n.dateKey !== entry.dateKey)
  log.unshift(entry)
  // Cap historique local
  writeJson(scopedKey(LOG_BASE), log.slice(0, 60))
  notifySleepChanged(options)
  return entry
}

export function clearSleepLog(options?: SleepStorageSaveOptions): void {
  writeJson(scopedKey(LOG_BASE), [])
  notifySleepChanged(options)
}

export function replaceSleepLog(entries: SleepNightEntry[], options?: SleepStorageSaveOptions): void {
  const normalized = entries
    .map((e) => normalizeSleepNightEntry(e))
    .filter((e): e is SleepNightEntry => e != null)
  writeJson(scopedKey(LOG_BASE), normalized)
  notifySleepChanged(options)
}
