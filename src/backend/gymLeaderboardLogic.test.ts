import { describe, expect, it } from 'vitest'
import {
  assertVisitDateAcceptable,
  countPointsFromVisitDateKeys,
  decidePresenceOnPhone,
  denseRankEntries,
  frenchOrdinalRank,
  MAX_COUNTED_SESSIONS_PER_WEEK,
  MAX_VISIT_AGE_DAYS,
  weekKeyFromDateKey,
} from '../../convex/gymLeaderboardLogic'

describe('gym leaderboard points (unit)', () => {
  it('counts max 2 sessions per week (extra = 0)', () => {
    // Mon–Fri same week
    const keys = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
    expect(weekKeyFromDateKey(keys[0]!)).toBe(weekKeyFromDateKey(keys[4]!))
    expect(countPointsFromVisitDateKeys(keys)).toBe(MAX_COUNTED_SESSIONS_PER_WEEK)
  })

  it('counts max 1 per day (dedupe)', () => {
    const keys = ['2026-10-05', '2026-10-05', '2026-10-05']
    expect(countPointsFromVisitDateKeys(keys)).toBe(1)
  })

  it('sums capped weeks across a month', () => {
    const keys = [
      '2026-10-05',
      '2026-10-06',
      '2026-10-07', // week A → 2
      '2026-10-12',
      '2026-10-13',
      '2026-10-14', // week B → 2
    ]
    expect(countPointsFromVisitDateKeys(keys)).toBe(4)
  })

  it('never loses points for rest days (absence = no change)', () => {
    const withRest = countPointsFromVisitDateKeys(['2026-10-05', '2026-10-07'])
    expect(withRest).toBe(2)
  })
})

describe('dense ranks / ties', () => {
  it('ties share rank; no tie-break by load/volume/time', () => {
    const ranked = denseRankEntries([
      { userId: 'a', pseudo: 'Alpha', points: 8 },
      { userId: 'b', pseudo: 'Beta', points: 8 },
      { userId: 'c', pseudo: 'Gamma', points: 7 },
      { userId: 'd', pseudo: 'Delta', points: 5 },
      { userId: 'e', pseudo: 'Epsilon', points: 5 },
      { userId: 'f', pseudo: 'Zeta', points: 4 },
    ])
    expect(ranked.filter((r) => r.rank === 1)).toHaveLength(2)
    expect(ranked.filter((r) => r.rank === 2)).toHaveLength(1)
    expect(ranked.filter((r) => r.rank === 3)).toHaveLength(2)
    expect(ranked.filter((r) => r.rank === 4)).toHaveLength(1)
    // Dense: after two at 1 and one at 2, next is 3 (not 4)
    expect(frenchOrdinalRank(1)).toBe('1er')
    expect(frenchOrdinalRank(4)).toBe('4e')
  })
})

describe('visit age gate', () => {
  it(`rejects sessions more than ${MAX_VISIT_AGE_DAYS} days late`, () => {
    expect(assertVisitDateAcceptable('2026-09-01', '2026-10-08')).toEqual({
      ok: false,
      reason: 'too_old',
    })
    expect(assertVisitDateAcceptable('2026-10-08', '2026-10-08')).toEqual({ ok: true })
    expect(assertVisitDateAcceptable('2026-10-01', '2026-10-08')).toEqual({ ok: true })
    expect(assertVisitDateAcceptable('2026-09-30', '2026-10-08')).toEqual({
      ok: false,
      reason: 'too_old',
    })
  })
})

describe('phone presence radius', () => {
  it('accepts within (distance − accuracy) ≤ 150 m', () => {
    // Same point
    expect(
      decidePresenceOnPhone({
        userLat: 49.655,
        userLng: 3.3,
        accuracyM: 20,
        gymLat: 49.655,
        gymLng: 3.3,
      }),
    ).toBe('at_gym')
  })

  it('returns imprecise when accuracy > 500 m', () => {
    expect(
      decidePresenceOnPhone({
        userLat: 49.655,
        userLng: 3.3,
        accuracyM: 600,
        gymLat: 49.655,
        gymLng: 3.3,
      }),
    ).toBe('imprecise')
  })
})
