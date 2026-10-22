/**
 * V3-11 — plafond 5000 kcal à l’écriture repas Convex (fake keys, pas de réseau).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkStoredMealCalories,
  MAX_STORED_MEAL_KCAL,
  MEAL_KCAL_ABOVE_MAX,
} from '../../convex/lib/foodAddUpsertSanitize'

describe('V3-11 — checkStoredMealCalories / upsertMeal', () => {
  it('accepte null / ≤5000 ; refuse >5000', () => {
    expect(MAX_STORED_MEAL_KCAL).toBe(5000)
    expect(checkStoredMealCalories(null)).toEqual({ ok: true, calories: null })
    expect(checkStoredMealCalories(undefined)).toEqual({ ok: true, calories: null })
    expect(checkStoredMealCalories(0)).toEqual({ ok: true, calories: 0 })
    expect(checkStoredMealCalories(5000)).toEqual({ ok: true, calories: 5000 })
    expect(checkStoredMealCalories(5001)).toEqual({ ok: false, code: MEAL_KCAL_ABOVE_MAX })
    expect(checkStoredMealCalories(9000)).toEqual({ ok: false, code: MEAL_KCAL_ABOVE_MAX })
  })

  it('upsertMeal appelle checkStoredMealCalories et jette MEAL_KCAL_ABOVE_MAX', () => {
    const source = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')
    const upsertIdx = source.indexOf('export const upsertMeal')
    expect(upsertIdx).toBeGreaterThan(-1)
    const block = source.slice(upsertIdx, upsertIdx + 6000)
    expect(block).toContain('checkStoredMealCalories')
    expect(block).toContain('MEAL_KCAL_ABOVE_MAX')
    expect(block).toContain('ConvexError')
  })
})
