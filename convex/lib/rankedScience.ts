/**
 * Ranked Force / Ranked Discipline — formules P0 (Matrice + ARCHI).
 * Pure functions only — unit-tested; no Convex / no bodyweight / no IAP.
 *
 * Réf. : docs/MATRICE_SCIENTIFIQUE_RANKED_FORCE.md · docs/ARCHI_RANKED.md
 */

export const RANKED_FORCE_EXERCISES = [
  'squat',
  'bench',
  'deadlift',
  'barbell_row',
  'ohp',
] as const

export type RankedForceExerciseId = (typeof RANKED_FORCE_EXERCISES)[number]

export type RankedSex = 'M' | 'F' | 'unknown'

export type AnomalyFlag = 'none' | 'A' | 'B'

export type LiftForceStatus =
  | 'declared'
  | 'pending_verify'
  | 'verified'
  | 'rejected_force'

/** Absolute caps (kg) — RF-CAP-01. Unknown sex → male (higher) ceiling. */
export const ABSOLUTE_CAPS_KG: Record<
  'squat' | 'bench' | 'deadlift',
  { M: number; F: number }
> = {
  squat: { M: 515, F: 340 },
  bench: { M: 375, F: 220 },
  deadlift: { M: 520, F: 315 },
}

/** Provisional review thresholds — RF-CAP-01b (not world-record bans). */
export const ROW_REVIEW_THRESHOLD_KG = 250
export const OHP_REVIEW_THRESHOLD_KG = 180

/** RF-ANOM-01 windows. */
export const ANOMALY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const NOVICE_HISTORY_MS = 8 * 7 * 24 * 60 * 60 * 1000

export const ANOMALY_A_PCT = 0.15
export const ANOMALY_B_PCT = 0.25
export const NOVICE_ANOMALY_A_PCT = 0.25
export const NOVICE_ANOMALY_B_PCT = 0.4

/** RF-DISC-01 */
export const DISCIPLINE_SESSIONS_CAP = 5
/** Product choice (Matrice N=2|3) — P0 figé N=3. */
export const DISCIPLINE_STREAK_MIN_SESSIONS = 3

/** Soft reset cycle length (middle of 6–8 weeks). */
export const CYCLE_LENGTH_MS = 7 * 7 * 24 * 60 * 60 * 1000

/** Self-verify second confirmation delay. */
export const SELF_VERIFY_DELAY_MS = 24 * 60 * 60 * 1000

export function isRankedForceExercise(id: string): id is RankedForceExerciseId {
  return (RANKED_FORCE_EXERCISES as readonly string[]).includes(id)
}

/**
 * RF-1RM-01 Epley: 1RM = w × (1 + r/30).
 * r = 1 → 1RM = w; 2≤r≤10 → estimated; r>10 → null (hors Force).
 */
export function estimateEpley1RmKg(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  if (!Number.isInteger(reps) || reps < 1) return null
  if (reps > 10) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function absoluteCapKg(
  exerciseId: 'squat' | 'bench' | 'deadlift',
  sex: RankedSex,
): number {
  const caps = ABSOLUTE_CAPS_KG[exerciseId]
  return sex === 'F' ? caps.F : caps.M
}

export function exceedsAbsoluteCap(
  exerciseId: RankedForceExerciseId,
  estimated1RmKg: number,
  sex: RankedSex,
): boolean {
  if (exerciseId !== 'squat' && exerciseId !== 'bench' && exerciseId !== 'deadlift') {
    return false
  }
  return estimated1RmKg > absoluteCapKg(exerciseId, sex)
}

/**
 * RF-CAP-01b relative ceilings.
 * Row requires verified deadlift PR; OHP requires verified bench PR.
 * Missing ref → not eligible for Force on that movement.
 */
export function relativeCapCheck(
  exerciseId: RankedForceExerciseId,
  estimated1RmKg: number,
  verifiedRefs: { deadlift?: number; bench?: number },
): { ok: boolean; needsReviewQueue: boolean; reason?: string } {
  if (exerciseId === 'barbell_row') {
    const ref = verifiedRefs.deadlift
    if (ref == null || !(ref > 0)) {
      return { ok: false, needsReviewQueue: false, reason: 'missing_deadlift_verified_pr' }
    }
    if (estimated1RmKg > ref) {
      return { ok: false, needsReviewQueue: false, reason: 'row_above_deadlift_verified' }
    }
    return {
      ok: true,
      needsReviewQueue: estimated1RmKg > ROW_REVIEW_THRESHOLD_KG,
    }
  }
  if (exerciseId === 'ohp') {
    const ref = verifiedRefs.bench
    if (ref == null || !(ref > 0)) {
      return { ok: false, needsReviewQueue: false, reason: 'missing_bench_verified_pr' }
    }
    if (estimated1RmKg > ref) {
      return { ok: false, needsReviewQueue: false, reason: 'ohp_above_bench_verified' }
    }
    return {
      ok: true,
      needsReviewQueue: estimated1RmKg > OHP_REVIEW_THRESHOLD_KG,
    }
  }
  return { ok: true, needsReviewQueue: false }
}

/**
 * RF-ANOM-01 — Δ1RM same movement within ≤7 days.
 * Novice (history < 8 weeks): A=25%, B=40%.
 */
export function classifyAnomaly(input: {
  previous1RmKg: number | null
  next1RmKg: number
  deltaWithinMs: number | null
  historySpanMs: number | null
}): AnomalyFlag {
  const { previous1RmKg, next1RmKg, deltaWithinMs, historySpanMs } = input
  if (
    previous1RmKg == null ||
    previous1RmKg <= 0 ||
    deltaWithinMs == null ||
    deltaWithinMs > ANOMALY_WINDOW_MS
  ) {
    return 'none'
  }
  const deltaPct = (next1RmKg - previous1RmKg) / previous1RmKg
  if (deltaPct <= 0) return 'none'

  const novice = historySpanMs != null && historySpanMs < NOVICE_HISTORY_MS
  const aPct = novice ? NOVICE_ANOMALY_A_PCT : ANOMALY_A_PCT
  const bPct = novice ? NOVICE_ANOMALY_B_PCT : ANOMALY_B_PCT

  if (deltaPct > bPct) return 'B'
  if (deltaPct > aPct) return 'A'
  return 'none'
}

export type AnomalyLiftSample = {
  estimated1RmKg: number
  createdAt: number
  status: LiftForceStatus
}

/**
 * Baseline Δ1RM (B2 + M4) :
 * - ignore `rejected_force`
 * - **préféré** : meilleur 1RM **vérifié** (jamais un échauffement déclaré)
 * - sans vérifié : max des lifts `pending_verify`/`verified` sur 7 j
 *   (pas le min des logs — évite faux positif warmup 50 → vrai 100)
 */
export function resolveAnomalyBaseline(input: {
  verified1RmKg: number | null
  verifiedAtMs: number | null
  recentLifts: AnomalyLiftSample[]
  nowMs: number
}): { baseline1RmKg: number | null; baselineAtMs: number | null } {
  // M4 — verified PR is the only healthy competitive baseline when present.
  if (input.verified1RmKg != null && input.verified1RmKg > 0) {
    return {
      baseline1RmKg: input.verified1RmKg,
      baselineAtMs: input.verifiedAtMs,
    }
  }

  const windowStart = input.nowMs - ANOMALY_WINDOW_MS
  const eligible = input.recentLifts.filter(
    (l) =>
      (l.status === 'pending_verify' || l.status === 'verified') &&
      Number.isFinite(l.estimated1RmKg) &&
      l.estimated1RmKg > 0 &&
      l.createdAt >= windowStart &&
      l.createdAt <= input.nowMs,
  )

  if (eligible.length === 0) {
    return { baseline1RmKg: null, baselineAtMs: null }
  }
  // Peak (not min) among competitive candidates — warmups/declared excluded.
  const peak = eligible.reduce((best, l) =>
    l.estimated1RmKg > best.estimated1RmKg ? l : best,
  )
  return { baseline1RmKg: peak.estimated1RmKg, baselineAtMs: peak.createdAt }
}

/** Friend-code alphabet (no 0/O/1/I). */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const FRIEND_CODE_LENGTH = 8

export function normalizeFriendCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidFriendCodeFormat(code: string): boolean {
  const n = normalizeFriendCode(code)
  if (n.length !== FRIEND_CODE_LENGTH) return false
  for (const ch of n) {
    if (!FRIEND_CODE_ALPHABET.includes(ch)) return false
  }
  return true
}

/** Deterministic-ish short code from userId + salt (pure, testable). */
export function deriveFriendCodeCandidate(userId: string, attempt: number): string {
  const seed = `${userId}::ranked-friend::${attempt}`
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let out = ''
  let x = h >>> 0
  for (let i = 0; i < FRIEND_CODE_LENGTH; i += 1) {
    out += FRIEND_CODE_ALPHABET[x % FRIEND_CODE_ALPHABET.length]!
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0
  }
  return out
}

/** Soft reset seed ratio — re-placement partiel (CA6), pas 100 % copy. */
export const SOFT_RESET_SEED_RATIO = 0.5

export function softResetSeedScore(previousScore: number): number {
  const safe = Number.isFinite(previousScore) ? Math.max(0, previousScore) : 0
  return Math.floor(safe * SOFT_RESET_SEED_RATIO)
}

/**
 * Discipline points for sessions in a rolling 7d window.
 * 6th and 7th sessions add 0 Ranked points (RF-DISC-01).
 */
export function disciplineSessionPoints(completedSessionsInWindow: number): number {
  if (!Number.isFinite(completedSessionsInWindow) || completedSessionsInWindow <= 0) return 0
  return Math.min(DISCIPLINE_SESSIONS_CAP, Math.floor(completedSessionsInWindow))
}

/**
 * Points awarded for one newly completed session given prior count in window.
 * Returns 0 if already at cap (6th+ session).
 */
export function disciplinePointsForNewSession(priorCountedInWindow: number): number {
  if (priorCountedInWindow >= DISCIPLINE_SESSIONS_CAP) return 0
  return 1
}

/** Product score: capped sessions + streak weeks (no recovery/health). */
export function disciplineScore(sessionsLast7dCapped: number, streakWeeks: number): number {
  const sessions = Math.max(0, Math.min(DISCIPLINE_SESSIONS_CAP, sessionsLast7dCapped))
  const streak = Math.max(0, Math.floor(streakWeeks))
  return sessions + streak
}

export type ForceBreakdown = {
  squat: number
  bench: number
  deadlift: number
  barbell_row: number
  ohp: number
}

/** Equal weighting P0 — missing movement = 0. */
export function forceScoreFromBreakdown(breakdown: ForceBreakdown): number {
  return (
    breakdown.squat +
    breakdown.bench +
    breakdown.deadlift +
    breakdown.barbell_row +
    breakdown.ohp
  )
}

export function emptyForceBreakdown(): ForceBreakdown {
  return { squat: 0, bench: 0, deadlift: 0, barbell_row: 0, ohp: 0 }
}

/** Public method payload (CA5) — no auth required. */
export function publicRankedMethod() {
  return {
    version: 'P0',
    forceExercises: [...RANKED_FORCE_EXERCISES],
    epley: {
      id: 'RF-1RM-01',
      formula: '1RM = w × (1 + r/30)',
      repsEligible: '1..10',
      repsOutOfForce: '>10',
      label: '1RM estimé',
      rowOhpNote: 'estimation non validée pour row barre / OHP (même formule)',
    },
    absoluteCapsKg: {
      squat: { M: 515, F: 340 },
      bench: { M: 375, F: 220 },
      deadlift: { M: 520, F: 315 },
      sexUnknownUses: 'M',
    },
    relativeCaps: {
      barbell_row: '≤ deadlift Vérifié',
      ohp: '≤ bench Vérifié',
      reviewThresholdsKg: { barbell_row: ROW_REVIEW_THRESHOLD_KG, ohp: OHP_REVIEW_THRESHOLD_KG },
    },
    anomalies: {
      id: 'RF-ANOM-01',
      windowDays: 7,
      A: '>15% → drapeau + double conf',
      B: '>25% → refus Force jusqu’à relecture',
      noviceLt8Weeks: { A: '25%', B: '40%' },
    },
    discipline: {
      id: 'RF-DISC-01',
      sessionsCapPer7d: DISCIPLINE_SESSIONS_CAP,
      streakMinSessionsPerWeek: DISCIPLINE_STREAK_MIN_SESSIONS,
      injuryPause: true,
      noSevenDayChallenge: true,
    },
    forceWeighting: 'equal_5',
    softReset: {
      id: 'RF-RESET-01',
      cycleWeeks: '6-8',
      preservesVerifiedPr: true,
    },
    never: ['bodyweight_display', 'iap_on_rank', 'look', 'biological_age', 'readiness_medical'],
    gymLeaderboard: 'P0-bis — hors premier livrable (amis = P0)',
  } as const
}

/** Decide submitLift Force pathway after 1RM computed. */
export function evaluateSubmitLift(input: {
  canonicalExerciseId: string
  weightKg: number
  reps: number
  sex: RankedSex
  verifiedRefs: { deadlift?: number; bench?: number }
  /** @deprecated Prefer baseline via resolveAnomalyBaseline — kept for tests. */
  previous1RmKg?: number | null
  previousAtMs?: number | null
  baseline1RmKg?: number | null
  baselineAtMs?: number | null
  historyFirstAtMs: number | null
  nowMs: number
}): {
  estimated1RmKg: number | null
  status: LiftForceStatus
  anomalyFlag: AnomalyFlag
  needsReviewQueue: boolean
  reason?: string
} {
  const estimated1RmKg = estimateEpley1RmKg(input.weightKg, input.reps)
  if (estimated1RmKg == null) {
    return {
      estimated1RmKg: null,
      status: 'declared',
      anomalyFlag: 'none',
      needsReviewQueue: false,
      reason: input.reps > 10 ? 'reps_gt_10' : 'invalid_lift',
    }
  }

  if (!isRankedForceExercise(input.canonicalExerciseId)) {
    return {
      estimated1RmKg,
      status: 'declared',
      anomalyFlag: 'none',
      needsReviewQueue: false,
      reason: 'not_force_exercise',
    }
  }

  const exerciseId = input.canonicalExerciseId

  if (exceedsAbsoluteCap(exerciseId, estimated1RmKg, input.sex)) {
    return {
      estimated1RmKg,
      status: 'rejected_force',
      anomalyFlag: 'none',
      needsReviewQueue: false,
      reason: 'absolute_cap',
    }
  }

  const relative = relativeCapCheck(exerciseId, estimated1RmKg, input.verifiedRefs)
  if (!relative.ok) {
    // Hors Force ; carnet Déclaré continue (ARCHI §6).
    return {
      estimated1RmKg,
      status: 'declared',
      anomalyFlag: 'none',
      needsReviewQueue: false,
      reason: relative.reason,
    }
  }

  const baseline1RmKg =
    input.baseline1RmKg !== undefined ? input.baseline1RmKg : (input.previous1RmKg ?? null)
  const baselineAtMs =
    input.baselineAtMs !== undefined ? input.baselineAtMs : (input.previousAtMs ?? null)

  const deltaWithinMs = baselineAtMs != null ? input.nowMs - baselineAtMs : null
  const historySpanMs =
    input.historyFirstAtMs != null ? input.nowMs - input.historyFirstAtMs : null

  const anomalyFlag = classifyAnomaly({
    previous1RmKg: baseline1RmKg,
    next1RmKg: estimated1RmKg,
    deltaWithinMs,
    historySpanMs,
  })

  if (anomalyFlag === 'B') {
    return {
      estimated1RmKg,
      status: 'rejected_force',
      anomalyFlag,
      needsReviewQueue: true,
      reason: 'anomaly_B',
    }
  }

  return {
    estimated1RmKg,
    status: 'pending_verify',
    anomalyFlag,
    needsReviewQueue: relative.needsReviewQueue || anomalyFlag === 'A',
    reason: anomalyFlag === 'A' ? 'anomaly_A' : undefined,
  }
}

/** League tiers for Ranked Force (names ≠ Bronze→Légende cosmetic). */
export const RANKED_LEAGUE_TIERS = [
  { tier: 1, name: 'Fer', minScore: 0, maxScore: 199 },
  { tier: 2, name: 'Acier', minScore: 200, maxScore: 399 },
  { tier: 3, name: 'Chrome', minScore: 400, maxScore: 699 },
  { tier: 4, name: 'Obsidienne', minScore: 700, maxScore: 999 },
  { tier: 5, name: 'Mythique', minScore: 1000, maxScore: Number.POSITIVE_INFINITY },
] as const

export function leagueTierForScore(score: number): (typeof RANKED_LEAGUE_TIERS)[number] {
  const safe = Number.isFinite(score) ? Math.max(0, score) : 0
  for (let i = RANKED_LEAGUE_TIERS.length - 1; i >= 0; i -= 1) {
    const league = RANKED_LEAGUE_TIERS[i]!
    if (safe >= league.minScore) return league
  }
  return RANKED_LEAGUE_TIERS[0]!
}

export function mapNutritionSexToRanked(sex: unknown): RankedSex {
  if (sex === 'male' || sex === 'M' || sex === 'm' || sex === 'homme') return 'M'
  if (sex === 'female' || sex === 'F' || sex === 'f' || sex === 'femme') return 'F'
  return 'unknown'
}
