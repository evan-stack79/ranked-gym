import { describe, expect, it } from 'vitest'
import {
  canAccessFoodAdd,
  canAccessFoodAddV3,
  canShowMealJournal,
  decideFoodAddAccess,
  decideFoodAddAccessV3,
  hasDeclaredEatingDisorderFlag,
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

  it('âge inconnu → legacy autorisé ; needsAgePrompt vrai (gate V3 seulement)', () => {
    expect(decideFoodAddAccess({ ...ADULT, age: null as unknown as number })).toEqual({
      allowed: true,
      reason: 'allowed',
    })
    expect(needsAgePrompt({ ...ADULT, age: undefined as unknown as number })).toBe(true)
    expect(canShowMealJournal({ ...ADULT, age: null as unknown as number })).toBe(true)
    expect(canAccessFoodAdd({ ...ADULT, age: null as unknown as number })).toBe(true)
  })
})

describe('foodAddAccess V3 — TCA même si healthAnswer none/prefer_not', () => {
  it('declaredEatingDisorder true refuse V3 même si healthAnswer none', () => {
    const profile = {
      ...ADULT,
      healthAnswer: 'none' as const,
      declaredEatingDisorder: true,
    }
    expect(hasDeclaredEatingDisorderFlag(profile)).toBe(true)
    expect(decideFoodAddAccessV3(profile)).toEqual({
      allowed: false,
      reason: 'eating_disorder',
    })
    expect(canAccessFoodAddV3(profile)).toBe(false)
    // Legacy path inchangé : healthAnswer none → declarations.eatingDisorder false
    expect(canAccessFoodAdd(profile)).toBe(true)
  })

  it('declaredEatingDisorder true refuse V3 même si healthAnswer prefer_not', () => {
    const profile = {
      ...ADULT,
      healthAnswer: 'prefer_not' as const,
      declaredEatingDisorder: true,
    }
    expect(canAccessFoodAddV3(profile)).toBe(false)
    expect(decideFoodAddAccessV3(profile).reason).toBe('eating_disorder')
  })

  it('sans flag TCA déclaré → V3 suit les déclarations healthAnswer', () => {
    expect(canAccessFoodAddV3({ ...ADULT, healthAnswer: 'none' })).toBe(true)
    expect(
      canAccessFoodAddV3({
        ...ADULT,
        healthAnswer: 'situations',
        declaredEatingDisorder: false,
      }),
    ).toBe(true)
  })
})
