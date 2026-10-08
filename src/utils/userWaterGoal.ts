/**
 * Single source of truth for the user’s daily water goal (ml).
 * localStorage only — never derived from body weight.
 *
 * Accueil tiles PR (#97) currently stores a water goal inside
 * `ranked-gym:accueil-widget-prefs`; that branch should switch to this module later.
 */

export const USER_WATER_GOAL_KEY = 'ranked-gym:water-goal'
export const USER_WATER_GOAL_VERSION = 1 as const

export const WATER_GOAL_MIN_ML = 250
export const WATER_GOAL_MAX_ML = 6000

/** Scientific-reviewer approved copy — no numbers. */
export const WATER_GOAL_CHOICE_ADVICE =
  'Choisis ton objectif. Ce dont tu as besoin change selon toi, la chaleur et l\'effort. En cas de doute, demande à un médecin.'

export const WATER_GOAL_CHANGED_EVENT = 'ranked-gym:water-goal-changed'

export type UserWaterGoalRecord = {
  version: typeof USER_WATER_GOAL_VERSION
  goalMl: number
  source: 'user'
  updatedAt: number
}

export function isValidUserWaterGoalMl(ml: unknown): ml is number {
  return typeof ml === 'number' && Number.isFinite(ml) && ml >= WATER_GOAL_MIN_ML && ml <= WATER_GOAL_MAX_ML
}

function emitWaterGoalChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WATER_GOAL_CHANGED_EVENT))
  }
}

function clearStoredGoal(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_WATER_GOAL_KEY)
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Parse a stored value. Only `{ source: 'user', goalMl in range }` is accepted.
 * Anything else is discarded and cleaned up from localStorage.
 */
export function parseUserWaterGoalRecord(raw: string | null): UserWaterGoalRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<UserWaterGoalRecord>
    if (!parsed || typeof parsed !== 'object') {
      clearStoredGoal()
      return null
    }
    if (parsed.source !== 'user') {
      clearStoredGoal()
      return null
    }
    if (!isValidUserWaterGoalMl(parsed.goalMl)) {
      clearStoredGoal()
      return null
    }
    const updatedAt =
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : Date.now()
    return {
      version: USER_WATER_GOAL_VERSION,
      goalMl: Math.round(parsed.goalMl),
      source: 'user',
      updatedAt,
    }
  } catch {
    clearStoredGoal()
    return null
  }
}

/** Returns the user-chosen goal in ml, or null if none / invalid. */
export function getUserWaterGoalMl(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const record = parseUserWaterGoalRecord(localStorage.getItem(USER_WATER_GOAL_KEY))
    return record?.goalMl ?? null
  } catch {
    return null
  }
}

/** Persist a user-chosen goal. Rejects out-of-range values. */
export function setUserWaterGoalMl(ml: number, now = Date.now()): boolean {
  if (!isValidUserWaterGoalMl(ml)) return false
  const record: UserWaterGoalRecord = {
    version: USER_WATER_GOAL_VERSION,
    goalMl: Math.round(ml),
    source: 'user',
    updatedAt: now,
  }
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(USER_WATER_GOAL_KEY, JSON.stringify(record))
    emitWaterGoalChanged()
    return true
  } catch {
    return false
  }
}

export function clearUserWaterGoal(): void {
  clearStoredGoal()
  emitWaterGoalChanged()
}

/**
 * Parse a free-form amount typed by the user (ml or L).
 * Values ≤ 20 are treated as liters (e.g. "2" → 2000, "1,5" → 1500).
 * Values > 20 are treated as milliliters.
 */
export function parseWaterGoalInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const hasLiterUnit = /l$/.test(lower) && !/ml$/.test(lower)
  const hasMlUnit = /ml$/.test(lower)
  const numericPart = lower.replace(/ml$|l$/, '')
  const value = Number(numericPart)
  if (!Number.isFinite(value) || value <= 0) return null
  if (hasMlUnit) return Math.round(value)
  if (hasLiterUnit) return Math.round(value * 1000)
  if (value <= 20) return Math.round(value * 1000)
  return Math.round(value)
}
