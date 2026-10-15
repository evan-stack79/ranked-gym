import { describe, expect, it } from 'vitest'
import { isCalorieGoalEnabled } from './calorieGoalFeatureFlag'

describe('VITE_ENABLE_CALORIE_GOAL', () => {
  it('absent / vide → désactivé', () => {
    expect(isCalorieGoalEnabled(undefined)).toBe(false)
    expect(isCalorieGoalEnabled('')).toBe(false)
    expect(isCalorieGoalEnabled('false')).toBe(false)
  })

  it('true / 1 / yes → activé (injection tests)', () => {
    expect(isCalorieGoalEnabled('true')).toBe(true)
    expect(isCalorieGoalEnabled('1')).toBe(true)
    expect(isCalorieGoalEnabled('yes')).toBe(true)
  })
})
