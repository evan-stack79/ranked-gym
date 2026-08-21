import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'

export const STREAK_WEEK_BONUS_XP = 500
export const XP_PER_LEVEL = 1000

export type StreakApplyResult = {
  profile: ProfileRow
  /** True when streak changed today (first open of the day). */
  didUpdate: boolean
  /** True when landing on a multiple of 7 days. */
  weekBonus: boolean
  bonusXp: number
  previousStreak: number
}

/** Local calendar date as YYYY-MM-DD (user timezone). */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function yesterdayDateKey(date = new Date()): string {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return localDateKey(d)
}

/** Normalize Postgres DATE / ISO string to YYYY-MM-DD. */
export function asDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
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
  let nextLevel = Math.max(1, level)
  let nextXp = Math.max(0, xp) + Math.max(0, bonusXp)
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

/**
 * Apply daily login streak rules on profiles:
 * - same day → no change
 * - yesterday → streak + 1
 * - otherwise → streak = 1
 * Multiples of 7 → +500 XP bonus.
 */
export async function applyDailyLoginStreak(profile: ProfileRow): Promise<StreakApplyResult> {
  const today = localDateKey()
  const yesterday = yesterdayDateKey()
  const last = asDateKey(profile.last_login_date)
  const previousStreak = Math.max(0, profile.current_streak ?? 0)

  if (last === today) {
    return {
      profile,
      didUpdate: false,
      weekBonus: false,
      bonusXp: 0,
      previousStreak,
    }
  }

  let nextStreak = 1
  if (last === yesterday) {
    nextStreak = previousStreak + 1
  }

  const weekBonus = nextStreak > 0 && nextStreak % 7 === 0
  const bonusXp = weekBonus ? STREAK_WEEK_BONUS_XP : 0
  const progress = addXpToProfile(profile.level, profile.xp, bonusXp)

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      current_streak: nextStreak,
      last_login_date: today,
      level: progress.level,
      xp: progress.xp,
      rank: progress.rank,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select('*')
    .single()

  if (error) throw error

  return {
    profile: data,
    didUpdate: true,
    weekBonus,
    bonusXp,
    previousStreak,
  }
}

export function isStreakActiveToday(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false
  return asDateKey(profile.last_login_date) === localDateKey()
}
