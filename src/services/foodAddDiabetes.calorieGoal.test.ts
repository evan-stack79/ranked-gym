/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { getNutritionTarget, hasMealTargets } from './nutritionActivity'
import { canAccessFoodAdd } from './foodAddAccess'
import { decideLossEligibility } from './nutritionSafetyRules'
import type { CalorieProfile } from '../types/nutrition'

const DIABETIC: CalorieProfile = {
  weightKg: 80,
  goalWeightKg: 75,
  heightCm: 178,
  age: 34,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'cut',
  weeklyPaceKg: 0.4,
  onboardingComplete: true,
  healthAnswer: 'none',
  declaredDiabetes: true,
}

describe('Diabète — voit Ajouter un aliment, sans objectif kcal', () => {
  it('un compte diabétique voit l’écran Ajouter un aliment', () => {
    expect(canAccessFoodAdd(DIABETIC)).toBe(true)
  })

  it('un compte diabétique n’a pas d’objectif calorique / perte', () => {
    const nutrition = getNutritionTarget(DIABETIC, { calorieGoalEnabled: true })
    expect(nutrition.showCalorieGoal).toBe(false)
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(nutrition.targetCalories).toBe(0)

    const loss = decideLossEligibility(DIABETIC, { calorieGoalEnabled: true })
    expect(loss.eligible).toBe(false)
    expect(loss.reason).toBe('diabetes')
  })
})
