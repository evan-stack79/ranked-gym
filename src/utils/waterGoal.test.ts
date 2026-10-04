import { describe, expect, it } from 'vitest'
import {
  calculateDailyWaterGoal,
  FALLBACK_WATER_WEIGHT_KG,
  getDailyWaterGoalMl,
  WATER_ML_PER_KG,
} from './waterGoal'

describe('QA BUG-37 — objectif d’eau avec poids ≤ 0', () => {
  it('replie à 70 kg quand le poids est 0 (mineur sans saisie)', () => {
    const expected = Math.round((FALLBACK_WATER_WEIGHT_KG * WATER_ML_PER_KG) / 100) * 100
    expect(calculateDailyWaterGoal(0, false)).toBe(expected)
    expect(getDailyWaterGoalMl(0, false)).toBe(expected)
    expect(expected).toBeGreaterThan(0)
  })

  it('replie à 70 kg pour poids négatif ou non fini', () => {
    const expected = Math.round((70 * WATER_ML_PER_KG) / 100) * 100
    expect(calculateDailyWaterGoal(-5, false)).toBe(expected)
    expect(calculateDailyWaterGoal(Number.NaN, false)).toBe(expected)
  })

  it('conserve le calcul normal pour un poids positif', () => {
    expect(calculateDailyWaterGoal(80, false)).toBe(2800)
    expect(calculateDailyWaterGoal(80, true)).toBe(3500)
  })
})
