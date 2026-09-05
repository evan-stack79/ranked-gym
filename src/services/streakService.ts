import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'

export const STREAK_WEEK_BONUS_XP = 500
export const XP_PER_LEVEL = 1000

/** Paliers panthère — uniquement ces valeurs. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const

export type StreakApplyResult = {
  profile: ProfileRow
  /** True when streak changed today (first open of the day). */
  didUpdate: boolean
  /** True when landing on a multiple of 7 days. */
  weekBonus: boolean
  bonusXp: number
  previousStreak: number
}

export type StreakTransition = {
  today: string
  yesterday: string
  lastKey: string | null
  previousStreak: number
  nextStreak: number
  didUpdate: boolean
  /** True uniquement si next === previous + 1 (inclut 0 → 1). */
  shouldCelebrate: boolean
  weekBonus: boolean
  bonusXp: number
}

export type WeekDayCell = {
  /** L M M J V S D */
  label: string
  /** 0 = lundi … 6 = dimanche */
  weekdayIndex: number
  isToday: boolean
  /** Couvert par la série actuelle (portion réelle de la semaine). */
  isCovered: boolean
}

const WEEK_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/** Local calendar date as YYYY-MM-DD (user timezone). */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function yesterdayDateKey(date = new Date()): string {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() - 1)
  return localDateKey(d)
}

/** Normalize Postgres DATE / ISO string to YYYY-MM-DD. */
export function asDateKey(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const parsed = Date.parse(trimmed)
  if (!Number.isFinite(parsed)) return null
  return localDateKey(new Date(parsed))
}

export function addXpToProfile(
  level: number,
  xp: number,
  bonusXp: number,
): { level: number; xp: number; rank: string } {
  let nextLevel = Math.max(1, Number.isFinite(level) ? level : 1)
  let nextXp = Math.max(0, Number.isFinite(xp) ? xp : 0) + Math.max(0, bonusXp)
  while (nextXp >= XP_PER_LEVEL) {
    nextXp -= XP_PER_LEVEL
    nextLevel += 1
  }
  return {
    level: nextLevel,
    xp: nextXp,
    rank: getRankFromLevel(nextLevel).tier,
  }
}

export function isStreakMilestone(streak: number): boolean {
  const n = Math.floor(streak)
  return STREAK_MILESTONES.includes(n as (typeof STREAK_MILESTONES)[number])
}

/**
 * Pure streak transition — injectable clock for deterministic tests.
 * Dates are always local calendar keys.
 */
export function computeStreakTransition(
  lastLoginDate: string | null | undefined,
  previousStreakRaw: number,
  now: Date = new Date(),
): StreakTransition {
  const today = localDateKey(now)
  const yesterday = yesterdayDateKey(now)
  const lastKey = asDateKey(lastLoginDate)
  const previousStreak = Math.max(
    0,
    Number.isFinite(previousStreakRaw) ? Math.floor(previousStreakRaw) : 0,
  )

  if (lastKey === today) {
    return {
      today,
      yesterday,
      lastKey,
      previousStreak,
      nextStreak: previousStreak,
      didUpdate: false,
      shouldCelebrate: false,
      weekBonus: false,
      bonusXp: 0,
    }
  }

  let nextStreak = 1
  if (lastKey === yesterday) {
    nextStreak = previousStreak + 1
  }

  const shouldCelebrate = nextStreak === previousStreak + 1
  const weekBonus = nextStreak > 0 && nextStreak % 7 === 0
  const bonusXp = weekBonus ? STREAK_WEEK_BONUS_XP : 0

  return {
    today,
    yesterday,
    lastKey,
    previousStreak,
    nextStreak,
    didUpdate: true,
    shouldCelebrate,
    weekBonus,
    bonusXp,
  }
}

/**
 * Apply daily login streak rules on profiles:
 * - same day → no change
 * - yesterday → streak + 1
 * - otherwise → streak = 1
 * Multiples of 7 → +500 XP bonus.
 *
 * Concurrency: the UPDATE is conditioned on the authoritative
 * `last_login_date` (including `IS NULL`). If another writer already
 * advanced the row, zero rows match → refetch and return `didUpdate: false`.
 * Guarantees at most +1 on `current_streak` per local day, even under
 * parallel calls (multi-tab / multi-device).
 */
export async function applyDailyLoginStreak(
  profile: ProfileRow,
  now: Date = new Date(),
): Promise<StreakApplyResult> {
  const transition = computeStreakTransition(
    profile.last_login_date,
    profile.current_streak ?? 0,
    now,
  )

  if (!transition.didUpdate) {
    return {
      profile,
      didUpdate: false,
      weekBonus: false,
      bonusXp: 0,
      previousStreak: transition.previousStreak,
    }
  }

  const progress = addXpToProfile(profile.level, profile.xp, transition.bonusXp)
  const supabase = getSupabase()
  const expectedLastLogin = asDateKey(profile.last_login_date)

  let updateQuery = supabase
    .from('profiles')
    .update({
      current_streak: transition.nextStreak,
      last_login_date: transition.today,
      level: progress.level,
      xp: progress.xp,
      rank: progress.rank,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  // Optimistic lock on last_login_date — null must use `.is()`, not `.eq(null)`.
  if (expectedLastLogin === null) {
    updateQuery = updateQuery.is('last_login_date', null)
  } else {
    updateQuery = updateQuery.eq('last_login_date', expectedLastLogin)
  }

  const { data, error } = await updateQuery.select('*').maybeSingle()

  if (error) throw error

  if (!data) {
    // Lost the race: another call already wrote today's date (or changed it).
    const { data: fresh, error: refetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single()

    if (refetchError) throw refetchError

    return {
      profile: fresh,
      didUpdate: false,
      weekBonus: false,
      bonusXp: 0,
      previousStreak: fresh.current_streak ?? transition.previousStreak,
    }
  }

  return {
    profile: data,
    didUpdate: true,
    weekBonus: transition.weekBonus,
    bonusXp: transition.bonusXp,
    previousStreak: transition.previousStreak,
  }
}

export function isStreakActiveToday(
  profile: ProfileRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profile) return false
  return asDateKey(profile.last_login_date) === localDateKey(now)
}

/** Lundi local 00:00 de la semaine contenant `now`. */
export function startOfLocalWeek(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay() // 0 dimanche … 6 samedi
  const offset = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Bandeau L→D : portion réelle de la semaine couverte par la série actuelle.
 * Ne marque jamais de jours futurs ni de jours hors série.
 */
export function getWeekStripDays(
  streak: number,
  now: Date = new Date(),
): WeekDayCell[] {
  const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monday = startOfLocalWeek(now)
  const todayIdx = (() => {
    const dow = today.getDay()
    return dow === 0 ? 6 : dow - 1
  })()

  return WEEK_LABELS_FR.map((label, weekdayIndex) => {
    const cellDate = new Date(monday)
    cellDate.setDate(monday.getDate() + weekdayIndex)
    const daysFromToday = Math.round(
      (today.getTime() - cellDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    const isToday = weekdayIndex === todayIdx
    const isCovered =
      safeStreak > 0 && daysFromToday >= 0 && daysFromToday < safeStreak && weekdayIndex <= todayIdx
    return { label, weekdayIndex, isToday, isCovered }
  })
}

export function getStreakStatusMessage(streak: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0))
  if (n <= 1) return 'Ta nouvelle série commence aujourd’hui.'
  if (n >= 2 && n <= 6) {
    const left = 7 - n
    return `Encore ${left} jour${left > 1 ? 's' : ''} pour compléter la semaine.`
  }
  if (n > 0 && n % 7 === 0) {
    const weeks = n / 7
    return `${weeks} semaine${weeks > 1 ? 's' : ''} consécutive${weeks > 1 ? 's' : ''}.`
  }
  return `Tu avances depuis ${n} jours consécutifs.`
}

export function formatStreakDaysLabel(streak: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0))
  return n <= 1 ? '1 jour de série' : `${n} jours de série`
}

// —— Celebration guard (local, per account) ————————————————

type CelebrationGuard = {
  lastCelebratedStreakDateKey?: string
  lastCelebratedStreakValue?: number
}

function celebrationStorageKey(userId: string): string {
  return `ranked-gym:streak-celebration:u:${userId}`
}

function readCelebrationGuard(userId: string): CelebrationGuard {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(celebrationStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CelebrationGuard
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCelebrationGuard(userId: string, guard: CelebrationGuard): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(celebrationStorageKey(userId), JSON.stringify(guard))
  } catch {
    // quota / private mode
  }
}

/**
 * True si cette incrémentation a déjà été célébrée (anti-replay).
 *
 * Limite multi-appareil :
 * - garde stockée dans `localStorage` → anti-replay garanti sur le même
 *   appareil / navigateur (reload, onglet, remount) ;
 * - un autre appareil peut encore afficher la célébration une fois ;
 * - le streak Supabase, lui, n’est jamais incrémenté deux fois grâce à
 *   l’UPDATE conditionné sur `last_login_date` (voir `applyDailyLoginStreak`).
 */
export function hasCelebratedStreak(
  userId: string,
  dateKey: string,
  streakValue: number,
): boolean {
  if (!userId || !dateKey) return true
  const guard = readCelebrationGuard(userId)
  return (
    guard.lastCelebratedStreakDateKey === dateKey &&
    guard.lastCelebratedStreakValue === streakValue
  )
}

export function markStreakCelebrated(
  userId: string,
  dateKey: string,
  streakValue: number,
): void {
  if (!userId || !dateKey) return
  writeCelebrationGuard(userId, {
    lastCelebratedStreakDateKey: dateKey,
    lastCelebratedStreakValue: streakValue,
  })
}

/** Test helper — clear celebration guard for a user. */
export function clearStreakCelebrationGuard(userId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(celebrationStorageKey(userId))
  } catch {
    // ignore
  }
}
