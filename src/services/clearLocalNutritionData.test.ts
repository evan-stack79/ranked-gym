/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalNutritionData,
  getCalorieProfile,
  getMealJournal,
  saveCalorieProfile,
  saveMealJournal,
} from './nutritionStorage'
import { resetSecureLocalStoreForTests } from './secureLocalStore'

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => 'user-qa-10',
}))

describe('QA BUG-10 — purge locale à la suppression de compte', () => {
  beforeEach(() => {
    resetSecureLocalStoreForTests()
    localStorage.clear()
  })

  it('efface profil (dont situations de santé), journal et caches', () => {
    saveCalorieProfile({
      weightKg: 70,
      goalWeightKg: 68,
      heightCm: 175,
      age: 28,
      sex: 'female',
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'maintain',
      weeklyPaceKg: 0,
      onboardingComplete: true,
      declaredPregnancy: true,
      declaredBreastfeeding: false,
      declaredEatingDisorder: true,
      preferNotAnswerHealth: false,
    })
    saveMealJournal({
      '2026-10-02': {
        dateKey: '2026-10-02',
        meals: [
          {
            id: 'm1',
            name: 'Test',
            calories: 500,
            proteinG: 30,
            carbsG: 40,
            fatG: 10,
            mealType: 'lunch',
            createdAt: Date.now(),
          },
        ],
        waterMl: 500,
        waterEntries: [],
      },
    })
    localStorage.setItem('ranked-gym:piece-presets', '{"x":1}')
    localStorage.setItem(
      'ranked-gym:convex-nutrition-queue:u:user-qa-10',
      JSON.stringify([{ id: '1' }]),
    )

    expect(getCalorieProfile().declaredEatingDisorder).toBe(true)
    expect(Object.keys(getMealJournal()).length).toBeGreaterThan(0)

    clearLocalNutritionData({ userId: 'user-qa-10' })

    const after = getCalorieProfile()
    expect(after.onboardingComplete).toBe(false)
    expect(after.declaredPregnancy).toBe(false)
    expect(after.declaredEatingDisorder).toBe(false)
    expect(after.weightKg).toBe(0)
    expect(Object.keys(getMealJournal())).toHaveLength(0)
    expect(localStorage.getItem('ranked-gym:piece-presets')).toBeNull()
    expect(localStorage.getItem('ranked-gym:convex-nutrition-queue:u:user-qa-10')).toBeNull()
  })

  it('cas limite : idempotent si déjà vide', () => {
    expect(() => clearLocalNutritionData({ userId: null })).not.toThrow()
    expect(() => clearLocalNutritionData({ userId: 'user-qa-10' })).not.toThrow()
    expect(getCalorieProfile().onboardingComplete).toBe(false)
  })
})
