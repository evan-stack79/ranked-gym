import { describe, expect, it } from 'vitest'
import {
  civilAgeYearsAt,
  evaluatePurchaseAgeGate,
  parseIsoDateOnly,
} from '../../shared/subscriptions/age'

describe('subscription age gate (PRO-M03 / ARCHI §7)', () => {
  it('rejects invalid and future dates', () => {
    expect(parseIsoDateOnly('2023-02-29')).toBeNull()
    expect(parseIsoDateOnly('not-a-date')).toBeNull()
    const future = evaluatePurchaseAgeGate('2099-01-01', Date.UTC(2026, 10, 8))
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.reason).toBe('future_dob')
    const missing = evaluatePurchaseAgeGate(null)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.reason).toBe('missing_dob')
  })

  it('turns 15 on the birthday UTC, not the day before', () => {
    const dob = { year: 2011, month: 11, day: 8 }
    expect(civilAgeYearsAt(dob, { year: 2026, month: 11, day: 7 })).toBe(14)
    expect(civilAgeYearsAt(dob, { year: 2026, month: 11, day: 8 })).toBe(15)
    const eve = evaluatePurchaseAgeGate('2011-11-08', Date.UTC(2026, 10, 7))
    expect(eve.ok).toBe(false)
    if (!eve.ok) expect(eve.reason).toBe('underage')
    const day = evaluatePurchaseAgeGate('2011-11-08', Date.UTC(2026, 10, 8))
    expect(day.ok).toBe(true)
    if (day.ok) expect(day.ageYears).toBe(15)
  })

  it('handles leap-day birthday in non-leap years (civil)', () => {
    // Born 29 Feb 2008 → on 28 Feb 2023 still 14; on 1 Mar 2023 = 15
    expect(civilAgeYearsAt({ year: 2008, month: 2, day: 29 }, { year: 2023, month: 2, day: 28 })).toBe(
      14,
    )
    expect(civilAgeYearsAt({ year: 2008, month: 2, day: 29 }, { year: 2023, month: 3, day: 1 })).toBe(
      15,
    )
  })
})
