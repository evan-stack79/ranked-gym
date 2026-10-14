import { describe, expect, it } from 'vitest'
import {
  canAccessFoodAdd,
  canShowMealJournal,
  decideFoodAddAccess,
  needsAgePrompt,
} from './foodAddAccess'
import type { CalorieProfile } from '../types/nutrition'

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

describe('foodAddAccess — mineur / TCA / diabète / âge', () => {
  it('refuse les mineurs (<18)', () => {
    expect(decideFoodAddAccess({ ...ADULT, age: 17 })).toEqual({
      allowed: false,
      reason: 'minor',
    })
    expect(canAccessFoodAdd({ ...ADULT, age: 15 })).toBe(false)
  })

  it('refuse le TCA déclaré', () => {
    const tca = {
      ...ADULT,
      healthAnswer: 'situations' as const,
      declaredEatingDisorder: true,
    }
    expect(decideFoodAddAccess(tca).reason).toBe('eating_disorder')
    expect(canAccessFoodAdd(tca)).toBe(false)
    expect(canShowMealJournal(tca)).toBe(false)
  })

  it('autorise un compte diabétique (voit l’écran)', () => {
    const diabetic = {
      ...ADULT,
      healthAnswer: 'none' as const,
      declaredDiabetes: true,
    }
    expect(canAccessFoodAdd(diabetic)).toBe(true)
    expect(decideFoodAddAccess(diabetic)).toEqual({ allowed: true, reason: 'allowed' })
  })

  it('autorise un adulte sans restriction', () => {
    expect(canAccessFoodAdd(ADULT)).toBe(true)
    expect(canShowMealJournal(ADULT)).toBe(true)
  })

  it('âge inconnu → age_required (pas un refus silencieux / mineur)', () => {
    expect(decideFoodAddAccess({ ...ADULT, age: null as unknown as number })).toEqual({
      allowed: false,
      reason: 'age_required',
    })
    expect(needsAgePrompt({ ...ADULT, age: undefined as unknown as number })).toBe(true)
    expect(canShowMealJournal({ ...ADULT, age: null as unknown as number })).toBe(false)
  })
})
