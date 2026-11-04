import { describe, expect, it } from 'vitest'
import { convexTables } from '../../convex/schema.ts'
import {
  assertNoForbiddenProFields,
  catalogItemIsAvailable,
  computeCreditGrant,
  rateForCreditReason,
  REWARDS_ECONOMY_SEED,
  REWARDS_FORBIDDEN_PRO_FIELDS,
  utcDateString,
} from '../../convex/lib/rewardsEconomy'

describe('rewardsEconomy seed (GO Evan)', () => {
  it('hardcodes +10 session / +20 week / dailyCap 50 / seasonCap 1200', () => {
    expect(REWARDS_ECONOMY_SEED.ptsPerValidatedSession).toBe(10)
    expect(REWARDS_ECONOMY_SEED.ptsPerWeekObjective).toBe(20)
    expect(REWARDS_ECONOMY_SEED.dailyCap).toBe(50)
    expect(REWARDS_ECONOMY_SEED.seasonCap).toBe(1200)
  })

  it('rates ignore plan — same for free and Pro', () => {
    const config = REWARDS_ECONOMY_SEED
    expect(rateForCreditReason(config, 'discipline_session')).toBe(10)
    expect(rateForCreditReason(config, 'week_objective')).toBe(20)
  })
})

describe('computeCreditGrant caps', () => {
  it('applies daily and season caps identically (no multiplier path)', () => {
    expect(
      computeCreditGrant({
        rate: 10,
        earnedToday: 0,
        earnedTodayDate: '2026-11-04',
        todayUtc: '2026-11-04',
        earnedThisCycle: 0,
        dailyCap: 50,
        seasonCap: 1200,
      }),
    ).toBe(10)

    expect(
      computeCreditGrant({
        rate: 10,
        earnedToday: 45,
        earnedTodayDate: '2026-11-04',
        todayUtc: '2026-11-04',
        earnedThisCycle: 0,
        dailyCap: 50,
        seasonCap: 1200,
      }),
    ).toBe(5)

    expect(
      computeCreditGrant({
        rate: 10,
        earnedToday: 50,
        earnedTodayDate: '2026-11-04',
        todayUtc: '2026-11-04',
        earnedThisCycle: 0,
        dailyCap: 50,
        seasonCap: 1200,
      }),
    ).toBe(0)

    expect(
      computeCreditGrant({
        rate: 10,
        earnedToday: 0,
        earnedTodayDate: '2026-11-04',
        todayUtc: '2026-11-04',
        earnedThisCycle: 1195,
        dailyCap: 50,
        seasonCap: 1200,
      }),
    ).toBe(5)
  })

  it('resets daily counter across UTC midnight', () => {
    expect(
      computeCreditGrant({
        rate: 10,
        earnedToday: 50,
        earnedTodayDate: '2026-11-03',
        todayUtc: '2026-11-04',
        earnedThisCycle: 50,
        dailyCap: 50,
        seasonCap: 1200,
      }),
    ).toBe(10)
  })
})

describe('anti-P2W field guards', () => {
  it('rejects forbidden Pro fields', () => {
    for (const key of REWARDS_FORBIDDEN_PRO_FIELDS) {
      expect(() => assertNoForbiddenProFields({ [key]: true })).toThrow(
        `REWARDS_FORBIDDEN_FIELD:${key}`,
      )
    }
  })

  it('schema catalog/economy tables omit forbidden Pro fields', () => {
    const catalog = convexTables.rewardsCatalogItem
    const economy = convexTables.rewardsEconomyConfig
    const catalogFields = Object.keys((catalog as any).validator?.fields ?? {})
    // Convex defineTable stores validator; fall back to string inspection.
    const catalogSrc = JSON.stringify(catalog)
    const economySrc = JSON.stringify(economy)
    for (const key of REWARDS_FORBIDDEN_PRO_FIELDS) {
      expect(catalogSrc).not.toContain(`"${key}"`)
      expect(economySrc).not.toContain(`"${key}"`)
      expect(catalogFields).not.toContain(key)
    }
  })
})

describe('catalog availability', () => {
  it('filters inactive / out of window / zero stock', () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    expect(
      catalogItemIsAvailable(
        { active: true, availableFrom: now - 1, stockLogical: 1 },
        now,
      ),
    ).toBe(true)
    expect(
      catalogItemIsAvailable(
        { active: false, availableFrom: now - 1, stockLogical: 1 },
        now,
      ),
    ).toBe(false)
    expect(
      catalogItemIsAvailable(
        { active: true, availableFrom: now + 1, stockLogical: 1 },
        now,
      ),
    ).toBe(false)
    expect(
      catalogItemIsAvailable(
        { active: true, availableFrom: now - 10, availableTo: now - 1, stockLogical: 1 },
        now,
      ),
    ).toBe(false)
    expect(
      catalogItemIsAvailable(
        { active: true, availableFrom: now - 1, stockLogical: 0 },
        now,
      ),
    ).toBe(false)
  })
})

describe('utcDateString', () => {
  it('formats YYYY-MM-DD UTC', () => {
    expect(utcDateString(Date.parse('2026-11-04T23:30:00.000Z'))).toBe('2026-11-04')
  })
})
