/** Payload M2 — schedule.on uniquement (plugin 8.3.1). */
import { describe, expect, it } from 'vitest'
import { REMINDER_NOTIFICATION_IDS } from '../../shared/hydration'
import { buildHydrationReminderNotifications } from './hydrationReminders'

describe('hydrationReminders M2 payload', () => {
  it('sync-equivalent payload n’utilise jamais at/repeats', () => {
    const notes = buildHydrationReminderNotifications(['10:00', '14:00', '18:00'])
    expect(notes).toHaveLength(3)
    for (let i = 0; i < notes.length; i += 1) {
      expect(notes[i]?.id).toBe(REMINDER_NOTIFICATION_IDS[i])
      const raw = JSON.stringify(notes[i]?.schedule)
      expect(raw).not.toMatch(/"at"/)
      expect(raw).not.toMatch(/"repeats"/)
      expect(raw).not.toMatch(/"every"/)
      expect(notes[i]?.schedule.on.hour).toBe([10, 14, 18][i])
      expect(notes[i]?.schedule.on.minute).toBe(0)
    }
  })
})
