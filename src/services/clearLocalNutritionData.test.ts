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

  it('BUG-34 : efface aussi sommeil, entraînement, GPS et résidus santé', () => {
    localStorage.setItem('ranked-gym:sleep-log', '{"nights":[]}')
    localStorage.setItem('ranked-gym:training', '{"sessions":[]}')
    localStorage.setItem('ranked-gym:training:u:user-qa-10', '{"sessions":[]}')
    localStorage.setItem('ranked-gym:last-location', '{"lat":48.8,"lng":2.3}')
    localStorage.setItem('ranked-gym:check-in', '{"ok":1}')
    localStorage.setItem('ranked-gym:custom-gyms', '[]')
    localStorage.setItem('ranked-gym:profile', '{"xp":10}')
    localStorage.setItem('ranked-gym:cloud-backup-meta', '{"v":1}')
    localStorage.setItem('ranked-gym:reminder-fired', '{}')
    // Préférence hors santé — ne doit pas être effacée
    localStorage.setItem('ranked-gym:pro-pass-dismissed', '1')

    clearLocalNutritionData({ userId: 'user-qa-10' })

    expect(localStorage.getItem('ranked-gym:sleep-log')).toBeNull()
    expect(localStorage.getItem('ranked-gym:training')).toBeNull()
    expect(localStorage.getItem('ranked-gym:training:u:user-qa-10')).toBeNull()
    expect(localStorage.getItem('ranked-gym:last-location')).toBeNull()
    expect(localStorage.getItem('ranked-gym:check-in')).toBeNull()
    expect(localStorage.getItem('ranked-gym:custom-gyms')).toBeNull()
    expect(localStorage.getItem('ranked-gym:profile')).toBeNull()
    expect(localStorage.getItem('ranked-gym:cloud-backup-meta')).toBeNull()
    expect(localStorage.getItem('ranked-gym:reminder-fired')).toBeNull()
    expect(localStorage.getItem('ranked-gym:pro-pass-dismissed')).toBe('1')
  })

  it('cas limite : idempotent si déjà vide', () => {
    expect(() => clearLocalNutritionData({ userId: null })).not.toThrow()
    expect(() => clearLocalNutritionData({ userId: 'user-qa-10' })).not.toThrow()
    expect(getCalorieProfile().onboardingComplete).toBe(false)
  })
})
