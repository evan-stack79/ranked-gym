import { describe, expect, it } from 'vitest'
import { normalizeCalorieProfile } from './nutritionStorage'

describe('normalizeCalorieProfile — garde-fous lot 1', () => {
  it('ne force plus sex=male par défaut', () => {
    const next = normalizeCalorieProfile({
      weightKg: 70,
      goalWeightKg: 68,
      heightCm: 175,
      age: 30,
      sex: null,
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'maintain',
      weeklyPaceKg: 0,
      onboardingComplete: true,
    })
    expect(next.sex).toBeNull()
  })

  it('ramène une vitesse stockée 1,5 kg/sem au plafond', () => {
    const next = normalizeCalorieProfile({
      weightKg: 80,
      goalWeightKg: 75,
      heightCm: 175,
      age: 30,
      sex: 'female',
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'cut',
      weeklyPaceKg: 1.5,
      onboardingComplete: true,
    })
    expect(next.weeklyPaceKg).toBeLessThanOrEqual(0.9)
    expect(next.weeklyPaceKg).toBeLessThan(1.5)
  })
})
