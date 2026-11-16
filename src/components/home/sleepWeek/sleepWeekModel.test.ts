import { describe, expect, it } from 'vitest'
import { buildSleepWeekModel, mondayOfLocalDate } from './sleepWeekModel'
import type { SleepNightEntry } from '../../../services/sleepStorage'

function entry(dateKey: string): SleepNightEntry {
  return {
    id: `n-${dateKey}`,
    dateKey,
    bedtime: '23:00',
    waketime: '07:00',
    tstHours: null,
    feelingLevel: 3,
    createdAt: `${dateKey}T07:00:00.000Z`,
  }
}

describe('Ta semaine — ancrage lundi d’aujourd’hui', () => {
  it('lundi 16 avec dernier réveil lun 16 → semaine 16–22', () => {
    const now = new Date(2026, 10, 16, 12, 0, 0) // lun 16 nov 2026 local
    expect(mondayOfLocalDate(now)).toBe('2026-11-16')
    const model = buildSleepWeekModel([entry('2026-11-16')], 24, {}, { now, weekOffset: 0 })
    expect(model.weekStart).toBe('2026-11-16')
    expect(model.weekLabel).toBe('16 – 22 nov.')
    expect(model.days[0]?.dateNum).toBe(16)
    expect(model.days[6]?.dateNum).toBe(22)
    // Wake Mon 16 → night Sun 15 (semaine dernière) — jours futurs vides, pas de faux chiffre
    expect(model.days.filter((d) => d.future).every((d) => d.durationMin == null)).toBe(true)
  })

  it('« Semaine dernière » depuis lun 16 → 9–15', () => {
    const now = new Date(2026, 10, 16, 12, 0, 0)
    const model = buildSleepWeekModel([entry('2026-11-16')], 24, {}, { now, weekOffset: -1 })
    expect(model.weekStart).toBe('2026-11-09')
    expect(model.weekLabel).toBe('9 – 15 nov.')
    expect(model.days[0]?.dateNum).toBe(9)
    expect(model.days[6]?.dateNum).toBe(15)
  })

  it('dimanche 22 → toujours 16–22', () => {
    const now = new Date(2026, 10, 22, 18, 0, 0) // dim 22
    expect(mondayOfLocalDate(now)).toBe('2026-11-16')
    const model = buildSleepWeekModel([entry('2026-11-17')], 24, {}, { now, weekOffset: 0 })
    expect(model.weekStart).toBe('2026-11-16')
    expect(model.weekLabel).toBe('16 – 22 nov.')
  })
})
