import { describe, expect, it } from 'vitest'
import {
  chooseAlarmBackend,
  formatAlarmReadback,
  formatRepeatSummary,
  nextAlarmDate,
  nextOneShotAlarmDate,
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
    expect(formatRepeatSummary([1, 2, 3, 4, 5])).toBe('Lun → ven')
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

  it('Saturday 23:55 → Sunday 07:00 one-shot (7 h 05)', () => {
    // 2026-11-14 is a Saturday
    const now = new Date(2026, 10, 14, 23, 55, 0)
    expect(now.getDay()).toBe(6)
    const next = nextOneShotAlarmDate(7, 0, now)
    expect(next.getDay()).toBe(0) // Sunday
    expect(next.getDate()).toBe(15)
    expect(next.getHours()).toBe(7)
    expect(next.getMinutes()).toBe(0)
    const mins = Math.round((next.getTime() - now.getTime()) / 60_000)
    expect(mins).toBe(7 * 60 + 5)
    expect(formatAlarmReadback(next, now)).toBe('dimanche 07:00 · dans 7 h 05')
  })

  it('less than 5 s away rolls to next day', () => {
    const now = new Date(2026, 10, 11, 7, 0, 0, 0) // exactly 07:00
    const next = nextOneShotAlarmDate(7, 0, now)
    expect(next.getDate()).toBe(12)
    const almost = new Date(2026, 10, 11, 6, 59, 56) // 4 s before
    const next2 = nextOneShotAlarmDate(7, 0, almost)
    expect(next2.getDate()).toBe(12)
    const far = new Date(2026, 10, 11, 6, 59, 50) // 10 s before
    const next3 = nextOneShotAlarmDate(7, 0, far)
    expect(next3.getDate()).toBe(11)
  })

  it('DST spring forward still lands on the chosen wall-clock hour', () => {
    // Europe/Paris 2026-03-29 02:00 → 03:00. Saturday night before DST.
    // Use explicit local Date construction (CI may be UTC — we assert local hour/minute).
    const before = new Date(2026, 2, 28, 23, 0, 0) // Sat 23:00 local
    const next = nextOneShotAlarmDate(7, 0, before)
    expect(next.getHours()).toBe(7)
    expect(next.getMinutes()).toBe(0)
    expect(next.getTime()).toBeGreaterThan(before.getTime())
  })

  it('computes next weekday occurrence', () => {
    const now = new Date(2026, 10, 11, 10, 0, 0)
    const next = nextAlarmDate(7, 0, [5], now)
    expect(next.getDay()).toBe(5) // Friday
    expect(next.getHours()).toBe(7)
    expect(next.getMinutes()).toBe(0)
    expect(next.getTime()).toBeGreaterThan(now.getTime())
  })

  it('one-shot (no days): same day if time is still ahead', () => {
    const now = new Date(2026, 10, 11, 20, 0, 0)
    const next = nextAlarmDate(21, 0, [], now)
    expect(next.getDate()).toBe(11)
    expect(next.getHours()).toBe(21)
  })

  it('formats readback with hours and minutes', () => {
    const now = new Date(2026, 10, 11, 0, 0, 0)
    const fire = new Date(2026, 10, 11, 7, 5, 0)
    expect(formatAlarmReadback(fire, now)).toBe('mercredi 07:05 · dans 7 h 05')
  })

  it('snoozes by 9 minutes', () => {
    const from = new Date(2026, 10, 11, 7, 0, 0)
    const snoozed = snoozeFrom(from, 9)
    expect(snoozed.getTime() - from.getTime()).toBe(9 * 60_000)
  })
})
