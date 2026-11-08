import { describe, expect, it } from 'vitest'
import { defaultReminderTimes, sanitizeReminderTimes } from './hydrationReminders'

describe('hydrationReminders', () => {
  it('CA-HY11 défauts 10/14/18 et filtre nuit', () => {
    expect(defaultReminderTimes()).toEqual(['10:00', '14:00', '18:00'])
    expect(sanitizeReminderTimes(['10:00', '21:00', '03:00', '14:00', '18:00', '12:00'])).toEqual([
      '10:00',
      '14:00',
      '18:00',
    ])
  })
})
