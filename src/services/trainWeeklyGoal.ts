/**
 * Objectif de séances / semaine (Train).
 * Défaut 2 ; plage 1–5. Newest-wins via updatedAt. Jamais de points classement.
 */

export const WEEKLY_SESSION_GOAL_DEFAULT = 2 as const
export const WEEKLY_SESSION_GOAL_MIN = 1 as const
export const WEEKLY_SESSION_GOAL_MAX = 5 as const

export type WeeklySessionGoalTarget =
  | typeof WEEKLY_SESSION_GOAL_MIN
  | 2
  | 3
  | 4
  | typeof WEEKLY_SESSION_GOAL_MAX

export type WeeklySessionGoalRecord = {
  target: WeeklySessionGoalTarget
  updatedAt: number
  /**
   * Lundi Paris de la semaine où l’étincelle 100 % a déjà été jouée.
   * Une seule fois / semaine ; dépasser l’objectif ne rejoue rien.
   */
  sparkShownWeekKey?: string | null
}

export function clampWeeklySessionGoal(n: unknown): WeeklySessionGoalTarget {
  if (typeof n !== 'number' || !Number.isFinite(n)) return WEEKLY_SESSION_GOAL_DEFAULT
  const rounded = Math.round(n)
  if (rounded < WEEKLY_SESSION_GOAL_MIN) return WEEKLY_SESSION_GOAL_MIN
  if (rounded > WEEKLY_SESSION_GOAL_MAX) return WEEKLY_SESSION_GOAL_MAX
  return rounded as WeeklySessionGoalTarget
}

export function parseWeeklySessionGoal(
  raw: unknown,
  fallbackUpdatedAt = 0,
): WeeklySessionGoalRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      target: WEEKLY_SESSION_GOAL_DEFAULT,
      updatedAt: fallbackUpdatedAt,
      sparkShownWeekKey: null,
    }
  }
  const r = raw as Partial<WeeklySessionGoalRecord>
  const updatedAt =
    typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : fallbackUpdatedAt
  return {
    target: clampWeeklySessionGoal(r.target),
    updatedAt,
    sparkShownWeekKey:
      typeof r.sparkShownWeekKey === 'string' && r.sparkShownWeekKey
        ? r.sparkShownWeekKey
        : null,
  }
}

/** Newest-wins merge — offline changes survive a stale cloud pull. */
export function mergeWeeklySessionGoal(
  local: WeeklySessionGoalRecord | null | undefined,
  remote: WeeklySessionGoalRecord | null | undefined,
): WeeklySessionGoalRecord {
  const l = parseWeeklySessionGoal(local)
  const r = parseWeeklySessionGoal(remote)
  if (!local && !remote) return { target: WEEKLY_SESSION_GOAL_DEFAULT, updatedAt: 0 }
  if (!local) return r
  if (!remote) return l
  return l.updatedAt >= r.updatedAt ? l : r
}

export function resolveWeeklySessionGoal(
  record: WeeklySessionGoalRecord | null | undefined,
): WeeklySessionGoalTarget {
  return parseWeeklySessionGoal(record).target
}
