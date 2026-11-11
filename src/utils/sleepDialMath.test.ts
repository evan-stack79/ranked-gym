import { describe, expect, it } from 'vitest'
import { shiftSleepWindow, sleepSpanMinutes } from './sleepDialMath'
import { computeTibHours } from '../sleep-engine'

describe('sleepDialMath — décalage durée fixe', () => {
  it('calcule la durée au lit (minuit inclus)', () => {
    expect(sleepSpanMinutes('23:00', '07:00')).toBe(8 * 60)
    expect(sleepSpanMinutes('23:00', '06:30')).toBe(7 * 60 + 30)
  })

  it('décale lune et soleil ensemble sans changer la durée', () => {
    const next = shiftSleepWindow('23:00', '07:00', 30)
    expect(next).not.toBeNull()
    expect(next!.bedtime).toBe('23:30')
    expect(next!.waketime).toBe('07:30')
    expect(computeTibHours(next!.bedtime, next!.waketime)).toBeCloseTo(8, 5)
  })

  it('décale en arrière en passant minuit', () => {
    const next = shiftSleepWindow('00:30', '08:30', -60)
    expect(next).not.toBeNull()
    expect(next!.bedtime).toBe('23:30')
    expect(next!.waketime).toBe('07:30')
    expect(sleepSpanMinutes(next!.bedtime, next!.waketime)).toBe(8 * 60)
  })

  it('snap 5 min conserve la durée', () => {
    const next = shiftSleepWindow('22:00', '06:00', 12)
    expect(next).not.toBeNull()
    expect(sleepSpanMinutes(next!.bedtime, next!.waketime)).toBe(8 * 60)
  })
})
