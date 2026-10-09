import { describe, expect, it } from 'vitest'
import type { CalorieProfile } from '../types/nutrition'
import { getNutritionTarget, hasMealTargets } from './nutritionActivity'

const ADULT: CalorieProfile = {
  weightKg: 75,
  goalWeightKg: 72,
  heightCm: 175,
  age: 28,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0,
  onboardingComplete: true,
  healthAnswer: 'none',
}

describe('hasMealTargets — AR-01…AR-04 (cause racine)', () => {
  it('drapeau OFF → pas d’objectifs repas', () => {
    const nutrition = getNutritionTarget(ADULT, { calorieGoalEnabled: false })
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(nutrition.targetCalories).toBe(0)
  })

  it('ON sans cible (showCalorieGoal mais target 0) → pas d’objectifs repas', () => {
    expect(hasMealTargets({ showCalorieGoal: true, targetCalories: 0 })).toBe(false)
  })

  it('ON adulte avec cible → objectifs repas actifs', () => {
    const nutrition = getNutritionTarget(ADULT, { calorieGoalEnabled: true })
    expect(nutrition.showCalorieGoal).toBe(true)
    expect(nutrition.targetCalories).toBeGreaterThan(0)
    expect(hasMealTargets(nutrition)).toBe(true)
  })

  it('ON TCA → pas d’objectifs repas', () => {
    const nutrition = getNutritionTarget(
      { ...ADULT, healthAnswer: 'situations', declaredEatingDisorder: true },
      { calorieGoalEnabled: true },
    )
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(nutrition.targetCalories).toBe(0)
  })

  it('ON grossesse → pas d’objectifs repas', () => {
    const nutrition = getNutritionTarget(
      {
        ...ADULT,
        sex: 'female',
        healthAnswer: 'situations',
        declaredPregnancy: true,
      },
      { calorieGoalEnabled: true },
    )
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(nutrition.targetCalories).toBe(0)
  })

  it('ON mineur → pas d’objectifs repas', () => {
    const nutrition = getNutritionTarget(
      { ...ADULT, age: 16 },
      { calorieGoalEnabled: true },
    )
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(nutrition.targetCalories).toBe(0)
  })
})
