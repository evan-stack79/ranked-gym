import { describe, expect, it } from 'vitest'
import { getNutritionTarget } from './nutritionActivity'
import type { CalorieProfile } from '../types/nutrition'
import { Q1_18_ANS, Q4_IMC, M_INFO_1 } from '../content/safetyCopy'

const base: CalorieProfile = {
  weightKg: 80,
  goalWeightKg: 75,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'cut',
  weeklyPaceKg: 0.4,
  onboardingComplete: true,
  declaredPregnancy: false,
  declaredBreastfeeding: false,
  declaredEatingDisorder: false,
  preferNotAnswerHealth: false,
}

describe('QA BUG-05 — safetyNotices consommés via getNutritionTarget', () => {
  it('18 ans + cut : notice Q1_18_ANS présente', () => {
    const result = getNutritionTarget(
      { ...base, age: 18, goal: 'cut' },
      { calorieGoalEnabled: true },
    )
    expect(result.safetyNotices).toContain(Q1_18_ANS)
    expect(result.safetyNotices).toContain(M_INFO_1)
  })

  it('IMC bas + cut : notice Q4_IMC présente', () => {
    // Homme 40 ans, 200 cm, 73.96 kg → IMC ≈ 18.49
    const result = getNutritionTarget(
      {
        ...base,
        age: 40,
        heightCm: 200,
        weightKg: 73.96,
        goalWeightKg: 70,
        goal: 'cut',
      },
      { calorieGoalEnabled: true },
    )
    expect(result.safetyNotices).toContain(Q4_IMC)
  })

  it('cas limite drapeau OFF : M_INFO_1 seulement, pas de cible', () => {
    const result = getNutritionTarget(base, { calorieGoalEnabled: false })
    expect(result.showCalorieGoal).toBe(false)
    expect(result.targetCalories).toBe(0)
    expect(result.safetyNotices).toContain(M_INFO_1)
  })
})
