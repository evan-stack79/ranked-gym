/**
 * Pure economy helpers for partner rewards (ARCHI_REWARDS_PARTENAIRES).
 * Rates/caps come from rewardsEconomyConfig — never client constants / plan.
 * Anti-P2W: no pointMultiplier, capBonus, earlyAccess, or plan branching.
 */

export const REWARDS_LEDGER_REASONS = [
  'discipline_session',
  'week_objective',
  'redeem',
  'season_reset',
  'partner_refuse_recredit',
  'admin_adjust',
] as const

export type RewardsLedgerReason = (typeof REWARDS_LEDGER_REASONS)[number]

export const REWARDS_CREDIT_REASONS = ['discipline_session', 'week_objective'] as const
export type RewardsCreditReason = (typeof REWARDS_CREDIT_REASONS)[number]

export const REWARDS_CATEGORY_IDS = [
  'RP-CAT-01',
  'RP-CAT-02',
  'RP-CAT-03',
  'RP-CAT-04',
  'RP-CAT-05',
] as const
export type RewardsCategoryId = (typeof REWARDS_CATEGORY_IDS)[number]

/** GO Evan 4/11/2026 — seed defaults only (server config row). */
export const REWARDS_ECONOMY_SEED = {
  ptsPerValidatedSession: 10,
  ptsPerWeekObjective: 20,
  dailyCap: 50,
  seasonCap: 1200,
  /** 30 days */
  codeTtlMs: 30 * 24 * 60 * 60 * 1000,
} as const

/** Fields forbidden on catalog / entitlements (schema + runtime guards). */
export const REWARDS_FORBIDDEN_PRO_FIELDS = [
  'proOnly',
  'earlyAccessPro',
  'minPlan',
  'pointMultiplier',
  'capBonus',
  'earlyAccess',
] as const

export type RewardsEconomyRates = {
  ptsPerValidatedSession: number
  ptsPerWeekObjective: number
  dailyCap: number
  seasonCap: number
}

export function utcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function rateForCreditReason(
  config: RewardsEconomyRates,
  reason: RewardsCreditReason,
): number {
  return reason === 'discipline_session'
    ? config.ptsPerValidatedSession
    : config.ptsPerWeekObjective
}

/**
 * Cap-aware grant. Identical free/Pro — callers must never pass plan multipliers.
 */
export function computeCreditGrant(input: {
  rate: number
  earnedToday: number
  earnedTodayDate: string
  todayUtc: string
  earnedThisCycle: number
  dailyCap: number
  seasonCap: number
}): number {
  const rate = Math.max(0, Math.floor(input.rate))
  if (rate <= 0) return 0
  const earnedToday =
    input.earnedTodayDate === input.todayUtc ? Math.max(0, input.earnedToday) : 0
  const dailyRemaining = Math.max(0, input.dailyCap - earnedToday)
  const seasonRemaining = Math.max(0, input.seasonCap - Math.max(0, input.earnedThisCycle))
  return Math.min(rate, dailyRemaining, seasonRemaining)
}

export function assertNoForbiddenProFields(payload: Record<string, unknown>): void {
  for (const key of REWARDS_FORBIDDEN_PRO_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      throw new Error(`REWARDS_FORBIDDEN_FIELD:${key}`)
    }
  }
}

export function catalogItemIsAvailable(
  item: {
    active: boolean
    availableFrom: number
    availableTo?: number
    stockLogical: number
  },
  now: number,
): boolean {
  if (!item.active) return false
  if (item.stockLogical <= 0) return false
  if (item.availableFrom > now) return false
  if (item.availableTo != null && item.availableTo <= now) return false
  return true
}
