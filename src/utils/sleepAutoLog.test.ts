import { describe, expect, it } from 'vitest'
import {
  isInMorningAutoLogWindow,
  planMorningAutoLog,
  resolveAutoLogWaketime,
} from './sleepAutoLog'
import { averageTibHours, wakeRegularityStdMinutes } from './sleepStats'
import { computeTibHours } from '../sleep-engine'

describe('sleepAutoLog', () => {
  it('fenêtre 4 h–12 h inclusive début, exclusive fin', () => {
    expect(isInMorningAutoLogWindow(new Date(2026, 10, 10, 3, 59))).toBe(false)
    expect(isInMorningAutoLogWindow(new Date(2026, 10, 10, 4, 0))).toBe(true)
    expect(isInMorningAutoLogWindow(new Date(2026, 10, 10, 7, 12))).toBe(true)
    expect(isInMorningAutoLogWindow(new Date(2026, 10, 10, 11, 59))).toBe(true)
    expect(isInMorningAutoLogWindow(new Date(2026, 10, 10, 12, 0))).toBe(false)
  })

  it('lever = min(ouverture, prévu)', () => {
    expect(resolveAutoLogWaketime('07:12', '07:30')).toBe('07:12')
    expect(resolveAutoLogWaketime('09:00', '07:30')).toBe('07:30')
    expect(resolveAutoLogWaketime('07:30', '07:30')).toBe('07:30')
  })

  it('auto-log ok une fois : prévu + fenêtre + pas encore noté', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 7, 12),
      schedule: { bedtime: '23:00', waketime: '07:30' },
      nightAlreadyLogged: false,
      morningPromptDateKey: null,
    })
    expect(plan.shouldRun).toBe(true)
    expect(plan.reason).toBe('ok')
    expect(plan.dateKey).toBe('2026-11-10')
    expect(plan.bedtime).toBe('23:00')
    expect(plan.waketime).toBe('07:12')
  })

  it('refuse hors fenêtre', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 14, 0),
      schedule: { bedtime: '23:00', waketime: '07:30' },
      nightAlreadyLogged: false,
      morningPromptDateKey: null,
    })
    expect(plan.shouldRun).toBe(false)
    expect(plan.reason).toBe('outside_window')
  })

  it('refuse si déjà noté', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 7, 12),
      schedule: { bedtime: '23:00', waketime: '07:30' },
      nightAlreadyLogged: true,
      morningPromptDateKey: null,
    })
    expect(plan.shouldRun).toBe(false)
    expect(plan.reason).toBe('already_logged')
  })

  it('refuse si déjà prompté aujourd’hui (max 1×/jour)', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 8, 0),
      schedule: { bedtime: '23:00', waketime: '07:30' },
      nightAlreadyLogged: false,
      morningPromptDateKey: '2026-11-10',
    })
    expect(plan.shouldRun).toBe(false)
    expect(plan.reason).toBe('already_prompted_today')
  })

  it('refuse sans horaires prévus', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 7, 12),
      schedule: null,
      nightAlreadyLogged: false,
      morningPromptDateKey: null,
    })
    expect(plan.shouldRun).toBe(false)
    expect(plan.reason).toBe('no_schedule')
  })

  it('utilise le lever prévu s’il est plus tôt que l’ouverture', () => {
    const plan = planMorningAutoLog({
      now: new Date(2026, 10, 10, 9, 45),
      schedule: { bedtime: '23:00', waketime: '07:30' },
      nightAlreadyLogged: false,
      morningPromptDateKey: null,
    })
    expect(plan.shouldRun).toBe(true)
    expect(plan.waketime).toBe('07:30')
  })
})

describe('duration across midnight', () => {
  it('23:00 → 07:12 = 8 h 12', () => {
    expect(computeTibHours('23:00', '07:12')).toBeCloseTo(8 + 12 / 60, 5)
  })

  it('23:00 → 06:30 = 7 h 30', () => {
    expect(computeTibHours('23:00', '06:30')).toBeCloseTo(7.5, 5)
  })
})

describe('sleepStats', () => {
  it('moyenne 7 nuits (TIB)', () => {
    const nights = [
      { dateKey: '2026-11-10', bedtime: '23:00', waketime: '07:00' }, // 8
      { dateKey: '2026-11-09', bedtime: '23:00', waketime: '07:00' }, // 8
      { dateKey: '2026-11-08', bedtime: '22:00', waketime: '06:00' }, // 8
      { dateKey: '2026-11-07', bedtime: '00:00', waketime: '08:00' }, // 8
      { dateKey: '2026-11-06', bedtime: '23:30', waketime: '06:30' }, // 7
      { dateKey: '2026-11-05', bedtime: '23:00', waketime: '07:00' }, // 8
      { dateKey: '2026-11-04', bedtime: '23:00', waketime: '07:00' }, // 8
    ]
    const avg = averageTibHours(nights)
    expect(avg).toBeCloseTo((8 * 6 + 7) / 7, 5)
  })

  it('régularité lever : σ nulle si tous identiques', () => {
    const nights = [
      { dateKey: '2026-11-10', bedtime: '23:00', waketime: '07:00' },
      { dateKey: '2026-11-09', bedtime: '23:10', waketime: '07:00' },
      { dateKey: '2026-11-08', bedtime: '22:50', waketime: '07:00' },
    ]
    expect(wakeRegularityStdMinutes(nights)).toBeCloseTo(0, 5)
  })

  it('régularité lever : σ > 0 si levers dispersés', () => {
    const nights = [
      { dateKey: '2026-11-10', bedtime: '23:00', waketime: '06:00' },
      { dateKey: '2026-11-09', bedtime: '23:00', waketime: '08:00' },
      { dateKey: '2026-11-08', bedtime: '23:00', waketime: '07:00' },
    ]
    const std = wakeRegularityStdMinutes(nights)
    expect(std).not.toBeNull()
    expect(std!).toBeGreaterThan(30)
  })
})
