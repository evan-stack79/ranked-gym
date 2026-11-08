import { describe, expect, it } from 'vitest'
import {
  defaultReminderTimes,
  nextReminderAt,
  sanitizeReminderTimes,
} from './hydrationReminders'

describe('hydrationReminders', () => {
  it('CA-HY11 défauts 10/14/18 et filtre nuit', () => {
    expect(defaultReminderTimes()).toEqual(['10:00', '14:00', '18:00'])
    expect(sanitizeReminderTimes(['10:00', '21:00', '03:00', '14:00', '18:00', '12:00'])).toEqual([
      '10:00',
      '14:00',
      '18:00',
    ])
  })

  it('M2 skipToday reprend demain', () => {
    const now = new Date(2026, 10, 8, 15, 0, 0)
    const at = nextReminderAt(10, 0, now, true)
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(10)
    expect(at.getDate()).toBe(9)
  })
})
