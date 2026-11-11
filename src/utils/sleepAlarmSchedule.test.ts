import { describe, expect, it } from 'vitest'
import {
  chooseAlarmBackend,
  formatRepeatSummary,
  nextAlarmDate,
  snoozeFrom,
  toAlarmKitWeekday,
  toIosWeekday,
} from './sleepAlarmSchedule'

describe('sleepAlarmSchedule', () => {
  it('maps weekdays to iOS LocalNotifications (Sun=1)', () => {
    expect(toIosWeekday(1)).toBe(2) // Monday
    expect(toIosWeekday(7)).toBe(1) // Sunday
    expect(toIosWeekday(5)).toBe(6) // Friday
  })

  it('maps weekdays to AlarmKit strings', () => {
    expect(toAlarmKitWeekday(1)).toBe('MONDAY')
    expect(toAlarmKitWeekday(7)).toBe('SUNDAY')
  })

  it('summarizes repetition labels', () => {
    expect(formatRepeatSummary([1, 2, 3, 4, 5])).toBe('En semaine')
    expect(formatRepeatSummary([6, 7])).toBe('Week-end')
    expect(formatRepeatSummary([1, 2, 3, 4, 5, 6, 7])).toBe('Tous les jours')
    expect(formatRepeatSummary([])).toBe('Une fois')
  })

  it('chooses AlarmKit on iOS 26+, local-notification otherwise, unavailable off iOS', () => {
    expect(
      chooseAlarmBackend({ platform: 'ios', iosMajor: 26, alarmKitAvailable: true }),
    ).toBe('alarmkit')
    expect(
      chooseAlarmBackend({ platform: 'ios', iosMajor: 18, alarmKitAvailable: false }),
    ).toBe('local-notification')
    expect(
      chooseAlarmBackend({ platform: 'ios', iosMajor: null, alarmKitAvailable: true }),
    ).toBe('alarmkit')
    expect(
      chooseAlarmBackend({ platform: 'android', iosMajor: null, alarmKitAvailable: false }),
    ).toBe('unavailable')
    expect(
      chooseAlarmBackend({ platform: 'web', iosMajor: null, alarmKitAvailable: false }),
    ).toBe('unavailable')
  })

  it('computes next weekday occurrence', () => {
    // Wednesday 2026-11-11 10:00 — next Friday 07:00
    const now = new Date(2026, 10, 11, 10, 0, 0)
    const next = nextAlarmDate(7, 0, [5], now)
    expect(next.getDay()).toBe(5) // Friday
    expect(next.getHours()).toBe(7)
    expect(next.getMinutes()).toBe(0)
    expect(next.getTime()).toBeGreaterThan(now.getTime())
  })

  it('snoozes by 9 minutes', () => {
    const from = new Date(2026, 10, 11, 7, 0, 0)
    const snoozed = snoozeFrom(from, 9)
    expect(snoozed.getTime() - from.getTime()).toBe(9 * 60_000)
  })
})
