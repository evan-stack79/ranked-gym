import { describe, expect, it } from 'vitest'
import {
  REST_REMINDER_TEXT,
  hasTwoConsecutiveSessionDays,
  mergeRestReminderPrefs,
  shouldShowRestReminder,
  dismissRestReminderForCurrentWeek,
} from './trainRestReminder'
import { parisWeekKey } from '../utils/parisDate'

describe('rest reminder', () => {
  it('exact text, after 2 consecutive Paris days, once/week, dismissible, newest-wins off', () => {
    expect(REST_REMINDER_TEXT).toBe(
      "Le repos fait aussi partie de l'entraînement. Écoute ton corps.",
    )

    const notes = [
      { dateKey: '2026-10-07', createdAt: 1 },
      { dateKey: '2026-10-08', createdAt: 2 },
    ]
    const now = new Date('2026-10-08T12:00:00+02:00')
    expect(hasTwoConsecutiveSessionDays(notes, now)).toBe(true)

    const prefs = { enabled: true, updatedAt: 1, dismissedWeekKey: null as string | null }
    expect(shouldShowRestReminder(notes, prefs, now)).toBe(true)

    const dismissed = dismissRestReminderForCurrentWeek(prefs, now)
    expect(dismissed.dismissedWeekKey).toBe(parisWeekKey(now))
    expect(shouldShowRestReminder(notes, dismissed, now)).toBe(false)

    const off = mergeRestReminderPrefs(
      { enabled: false, updatedAt: 50 },
      { enabled: true, updatedAt: 10 },
    )
    expect(off.enabled).toBe(false)
    expect(shouldShowRestReminder(notes, off, now)).toBe(false)
  })
})
