/**
 * B15 — mergeCalorieProfilesForSync : SAFETY FIELDS serveur ne passent pas à false.
 */
import { describe, expect, it } from 'vitest'
import { BLANK_PROFILE, mergeCalorieProfilesForSync, normalizeCalorieProfile } from './nutritionStorage'

describe('B15 — mergeCalorieProfilesForSync safety fields', () => {
  it('remote true + local false → conserve true (TCA / diabète / grossesse / allaitement)', () => {
    const local = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      age: 30,
      healthAnswer: 'none',
      healthAnswerUpdatedAt: 9000,
      declaredEatingDisorder: false,
      declaredDiabetes: false,
      declaredPregnancy: false,
      declaredBreastfeeding: false,
    })
    const remote = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      age: 30,
      healthAnswer: 'situations',
      healthAnswerUpdatedAt: 1000,
      declaredEatingDisorder: true,
      declaredDiabetes: true,
      declaredPregnancy: true,
      declaredBreastfeeding: true,
    })
    const merged = mergeCalorieProfilesForSync(local, remote)
    expect(merged.declaredEatingDisorder).toBe(true)
    expect(merged.declaredDiabetes).toBe(true)
    expect(merged.declaredPregnancy).toBe(true)
    expect(merged.declaredBreastfeeding).toBe(true)
    expect(merged.healthAnswer).toBe('situations')
  })

  it('âge serveur valide gagne si local l’efface', () => {
    const local = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      age: 0,
      onboardingComplete: true,
      bodyMetricsClearedAt: 9000,
    })
    const remote = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      age: 16,
      onboardingComplete: true,
      bodyMetricsClearedAt: 1000,
    })
    const merged = mergeCalorieProfilesForSync(local, remote)
    expect(merged.age).toBe(16)
  })
})
