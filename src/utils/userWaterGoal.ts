/**
 * Single source of truth for the user’s daily water goal (ml).
 * localStorage only — never derived from body weight.
 *
 * One-time migration from Accueil widget prefs (`waterGoalMl`) lives in
 * `migrateAccueilWaterGoalFromPrefs` — call on prefs load / Accueil mount.
 */

export const USER_WATER_GOAL_KEY = 'ranked-gym:water-goal'
export const USER_WATER_GOAL_VERSION = 1 as const

/** Bornes techniques anti-faute de frappe : choix de prudence, non sourcé. Ne jamais afficher ces chiffres à l'utilisateur. */
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

/**
 * Round to an integer ml and accept only values inside the technical bounds.
 * Every persist / parse path must go through this so stored `goalMl` is always an integer.
 */
export function normalizeUserWaterGoalMl(ml: unknown): number | null {
  if (typeof ml !== 'number' || !Number.isFinite(ml)) return null
  const goalMl = Math.round(ml)
  if (goalMl < WATER_GOAL_MIN_ML || goalMl > WATER_GOAL_MAX_ML) return null
  return goalMl
}

export function isValidUserWaterGoalMl(ml: unknown): ml is number {
  return normalizeUserWaterGoalMl(ml) != null
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
    const goalMl = normalizeUserWaterGoalMl(parsed.goalMl)
    if (goalMl == null) {
      clearStoredGoal()
      return null
    }
    const updatedAt =
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : Date.now()
    const record: UserWaterGoalRecord = {
      version: USER_WATER_GOAL_VERSION,
      goalMl,
      source: 'user',
      updatedAt,
    }
    // Re-write if the stored payload had a non-integer goalMl
    if (parsed.goalMl !== goalMl) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(USER_WATER_GOAL_KEY, JSON.stringify(record))
        }
      } catch {
        // ignore quota / private mode
      }
    }
    return record
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

/** Persist a user-chosen goal. Rejects out-of-range values. Stored `goalMl` is always an integer. */
export function setUserWaterGoalMl(ml: number, now = Date.now()): boolean {
  const goalMl = normalizeUserWaterGoalMl(ml)
  if (goalMl == null) return false
  const record: UserWaterGoalRecord = {
    version: USER_WATER_GOAL_VERSION,
    goalMl,
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
 * Always returns an integer number of ml (or null).
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

const ACCUEIL_WIDGET_PREFS_KEY = 'ranked-gym:accueil-widget-prefs'

/**
 * One-time migration: if Accueil widget prefs still carry `waterGoalMl` and
 * no `userWaterGoal` exists, move it into `ranked-gym:water-goal` (source:'user'),
 * then delete it from widget prefs.
 * Returns true when a goal was migrated.
 */
export function migrateAccueilWaterGoalFromPrefs(now = Date.now()): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    if (getUserWaterGoalMl() != null) {
      // Still strip a stale prefs goal so there is a single source of truth.
      stripAccueilPrefsWaterGoal()
      return false
    }
    const raw = localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY)
    if (!raw) return false
    let parsed: { waterGoalMl?: unknown } | null = null
    try {
      parsed = JSON.parse(raw) as { waterGoalMl?: unknown }
    } catch {
      return false
    }
    if (!parsed || typeof parsed !== 'object') return false
    if (!('waterGoalMl' in parsed) || parsed.waterGoalMl == null) return false
    const goalMl = normalizeUserWaterGoalMl(
      typeof parsed.waterGoalMl === 'number'
        ? parsed.waterGoalMl
        : Number(parsed.waterGoalMl),
    )
    if (goalMl == null) {
      // Out of shared bounds or invalid — drop the legacy field, do not invent a goal.
      stripAccueilPrefsWaterGoal()
      return false
    }
    const saved = setUserWaterGoalMl(goalMl, now)
    if (saved) stripAccueilPrefsWaterGoal()
    return saved
  } catch {
    return false
  }
}

/** Remove `waterGoalMl` from Accueil widget prefs if present. */
export function stripAccueilPrefsWaterGoal(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY)
    if (!raw) return false
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return false
    }
    if (!parsed || typeof parsed !== 'object') return false
    if (!('waterGoalMl' in parsed) || parsed.waterGoalMl == null) return false
    delete parsed.waterGoalMl
    localStorage.setItem(ACCUEIL_WIDGET_PREFS_KEY, JSON.stringify(parsed))
    return true
  } catch {
    return false
  }
}
