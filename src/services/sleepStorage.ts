import { computeTibHours } from '../sleep-engine'
import { todayDateKey } from '../utils/sleepTimeFormat'

/**
 * Persistence locale des nuits — indépendant du Sleep Engine et de Nutrition.
 * Aucune donnée inventée : uniquement ce que l’utilisateur enregistre (ou auto-log v7).
 * TST optionnel (null = « Je ne sais pas » / pas de HealthKit).
 * Feeling + horaires prévus : locaux uniquement (pas de champ Convex).
 */

import { getActiveCloudUserId } from './cloudSession'
import { readLocal, removeLocal, writeLocal } from './secureLocalStore'

const LOG_BASE = 'ranked-gym:sleep-log'
const SCHEDULE_BASE = 'ranked-gym:sleep-schedule'
const MORNING_PROMPT_BASE = 'ranked-gym:sleep-morning-prompt'

export const SLEEP_CHANGED_EVENT = 'ranked-gym:sleep-changed'

export type SleepFeelingLevel = 1 | 2 | 3 | 4 | 5

export interface SleepNightEntry {
  id: string
  /** Date calendaire du lever (matin) YYYY-MM-DD. */
  dateKey: string
  /** HH:MM */
  bedtime: string
  /** HH:MM */
  waketime: string
  /**
   * Total Sleep Time (heures).
   * `null` = inconnu (jamais déduit du TIB).
   */
  tstHours: number | null
  /** Ressenti matin (1–5) — local only. */
  feelingLevel?: SleepFeelingLevel | null
  /** Origine de la saisie — local only. */
  source?: 'manual' | 'auto'
  createdAt: string
}

export interface SleepSchedule {
  bedtime: string
  waketime: string
}

export type SleepStorageSaveOptions = { skipCloud?: boolean }

function scopedKey(base: string): string {
  const uid = getActiveCloudUserId()
  return uid ? `${base}:u:${uid}` : base
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readLocal(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  writeLocal(key, JSON.stringify(value))
}

function notifySleepChanged(options?: SleepStorageSaveOptions) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SLEEP_CHANGED_EVENT))
  }
  if (!options?.skipCloud) {
    void import('./cloudBackup').then((m) => m.notifyLocalDataChanged()).catch(() => {})
  }
}

function asOptionalTstHours(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return undefined
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

function asFeelingLevel(value: unknown): SleepFeelingLevel | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as SleepFeelingLevel
  }
  return undefined
}

export function normalizeSleepNightEntry(
  input: Omit<SleepNightEntry, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
    tstHours?: number | null
    feelingLevel?: SleepFeelingLevel | null
    source?: 'manual' | 'auto'
  },
): SleepNightEntry | null {
  const bedtime = normalizeTimeHm(input.bedtime)
  const waketime = normalizeTimeHm(input.waketime)
  const dateKey =
    typeof input.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)
      ? input.dateKey
      : null

  if (!bedtime || !waketime || !dateKey) return null

  const tibHours = computeTibHours(bedtime, waketime)
  if (tibHours == null || tibHours <= 0) return null

  const tstParsed = asOptionalTstHours(input.tstHours)
  if (tstParsed === undefined) return null

  let tstHours: number | null = tstParsed
  if (tstHours != null) {
    if (tstHours < 0 || tstHours > 24) return null
    if (tstHours > tibHours + 1e-6) return null
  }

  const feelingParsed = asFeelingLevel(input.feelingLevel)
  if (feelingParsed === undefined && input.feelingLevel !== undefined) return null

  const source =
    input.source === 'auto' || input.source === 'manual' ? input.source : undefined

  return {
    id: input.id ?? `sleep-${dateKey}-${Date.now()}`,
    dateKey,
    bedtime,
    waketime,
    tstHours,
    feelingLevel: feelingParsed ?? null,
    source,
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

export function getSleepNightByDateKey(dateKey: string): SleepNightEntry | null {
  return getSleepLog().find((n) => n.dateKey === dateKey) ?? null
}

/** Fenêtre glissante des N nuits les plus récentes (défaut 7). */
export function getRecentSleepNights(limit = 7): SleepNightEntry[] {
  return getSleepLog().slice(0, Math.max(0, limit))
}

export function saveSleepNight(
  input: {
    bedtime: string
    waketime: string
    /** `null` = inconnu (« Je ne sais pas »). Jamais déduit du TIB. */
    tstHours: number | null
    dateKey?: string
    feelingLevel?: SleepFeelingLevel | null
    source?: 'manual' | 'auto'
  },
  options?: SleepStorageSaveOptions,
): SleepNightEntry | null {
  const existing = input.dateKey ? getSleepNightByDateKey(input.dateKey) : null
  const entry = normalizeSleepNightEntry({
    dateKey: input.dateKey ?? todayDateKey(),
    bedtime: input.bedtime,
    waketime: input.waketime,
    tstHours: input.tstHours,
    feelingLevel:
      input.feelingLevel !== undefined ? input.feelingLevel : (existing?.feelingLevel ?? null),
    source: input.source ?? existing?.source ?? 'manual',
    id: existing?.id,
    createdAt: existing?.createdAt,
  })
  if (!entry) return null

  const log = getSleepLog().filter((n) => n.dateKey !== entry.dateKey)
  log.unshift(entry)
  writeJson(scopedKey(LOG_BASE), log.slice(0, 60))
  notifySleepChanged(options)
  return entry
}

export function saveSleepFeeling(
  dateKey: string,
  feelingLevel: SleepFeelingLevel | null,
  options?: SleepStorageSaveOptions,
): SleepNightEntry | null {
  const existing = getSleepNightByDateKey(dateKey)
  if (!existing) return null
  return saveSleepNight(
    {
      dateKey,
      bedtime: existing.bedtime,
      waketime: existing.waketime,
      tstHours: existing.tstHours,
      feelingLevel,
      source: existing.source,
    },
    options,
  )
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

export function getSleepSchedule(): SleepSchedule | null {
  const raw = readJson<Partial<SleepSchedule> | null>(scopedKey(SCHEDULE_BASE), null)
  if (!raw) return null
  const bedtime = typeof raw.bedtime === 'string' ? normalizeTimeHm(raw.bedtime) : null
  const waketime = typeof raw.waketime === 'string' ? normalizeTimeHm(raw.waketime) : null
  if (!bedtime || !waketime) return null
  const tib = computeTibHours(bedtime, waketime)
  if (tib == null || tib <= 0) return null
  return { bedtime, waketime }
}

export function saveSleepSchedule(
  input: SleepSchedule,
  options?: SleepStorageSaveOptions,
): SleepSchedule | null {
  const bedtime = normalizeTimeHm(input.bedtime)
  const waketime = normalizeTimeHm(input.waketime)
  if (!bedtime || !waketime) return null
  const tib = computeTibHours(bedtime, waketime)
  if (tib == null || tib <= 0) return null
  const schedule = { bedtime, waketime }
  writeJson(scopedKey(SCHEDULE_BASE), schedule)
  notifySleepChanged(options)
  return schedule
}

export function clearSleepSchedule(options?: SleepStorageSaveOptions): void {
  removeLocal(scopedKey(SCHEDULE_BASE))
  notifySleepChanged(options)
}

export function getMorningPromptDateKey(): string | null {
  const raw = readLocal(scopedKey(MORNING_PROMPT_BASE))
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

export function markMorningPromptShown(
  dateKey: string = todayDateKey(),
  options?: SleepStorageSaveOptions,
): void {
  writeLocal(scopedKey(MORNING_PROMPT_BASE), dateKey)
  notifySleepChanged(options)
}

export function clearMorningPrompt(options?: SleepStorageSaveOptions): void {
  removeLocal(scopedKey(MORNING_PROMPT_BASE))
  notifySleepChanged(options)
}
