import { describe, expect, it } from 'vitest'
import {
  dateFromKey,
  dateKeyFromDate,
  formatNutritionDate,
  monthDays,
  nutritionDateLabel,
  shiftDateKey,
} from './nutritionDate'
import { todayKey } from './calories'

describe('nutritionDate', () => {
  it('conserve la date locale sans décalage UTC', () => {
    const key = dateKeyFromDate(new Date(2026, 8, 22, 23, 45))
    expect(key).toBe('2026-09-22')
    expect(dateKeyFromDate(dateFromKey(key))).toBe(key)
  })

  it('navigue vers hier, demain et les changements de mois', () => {
    expect(shiftDateKey('2026-09-01', -1)).toBe('2026-08-31')
    expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDateKey('2026-09-22', -2)).toBe('2026-09-20')
  })

  it('formate un jour court et un jour éloigné', () => {
    expect(formatNutritionDate('2026-09-22')).toMatch(/22 sept/i)
    expect(nutritionDateLabel(todayKey())).toMatch(/Aujourd’hui|Aujourd'hui/)
  })

  it('produit une grille locale complète pour le calendrier', () => {
    const days = monthDays(new Date(2026, 8, 1))
    const validDays = days.filter((date) => !Number.isNaN(date.getTime()))
    expect(validDays).toHaveLength(30)
    expect(validDays[0]?.getDate()).toBe(1)
    expect(validDays.at(-1)?.getDate()).toBe(30)
  })
})