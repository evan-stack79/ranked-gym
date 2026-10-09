import { describe, expect, it } from 'vitest'
import {
  areConsecutiveDateKeys,
  isDateKeyInParisWeek,
  parisDateKey,
  parisWeekDateKeys,
  parisWeekKey,
  shiftDateKey,
} from './parisDate'

describe('Europe/Paris session dating', () => {
  it('two consecutive Paris days, week bounds, and offline dateKey stay on the phone calendar', () => {
    expect(areConsecutiveDateKeys('2026-10-07', '2026-10-08')).toBe(true)
    expect(areConsecutiveDateKeys('2026-10-07', '2026-10-09')).toBe(false)
    expect(shiftDateKey('2026-10-08', -1)).toBe('2026-10-07')

    // Mercredi 2026-10-07 12:00 UTC+2 ≈ Paris → semaine lun 05 → dim 11
    const wed = new Date('2026-10-07T10:00:00Z')
    const week = parisWeekDateKeys(wed)
    expect(week.mondayKey).toBe('2026-10-05')
    expect(week.sundayKey).toBe('2026-10-11')
    expect(parisWeekKey(wed)).toBe('2026-10-05')
    expect(isDateKeyInParisWeek('2026-10-08', wed)).toBe(true)
    expect(isDateKeyInParisWeek('2026-10-04', wed)).toBe(false)

    // Late UTC evening still maps to Paris calendar day for the session
    const late = new Date('2026-10-07T22:30:00Z') // 00:30 Paris on the 8th (CEST)
    expect(parisDateKey(late)).toBe('2026-10-08')
  })
})
