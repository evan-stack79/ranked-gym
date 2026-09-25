import { describe, expect, it } from 'vitest'
import {
  isAutoSetValidationEnabled,
  isSportsOnboardingEnabled,
  isTrainingRecommendationsEnabled,
  resolveTrainingUxFlag,
} from './trainingFeatureFlags'

describe('training UX feature flags', () => {
  it('honore une valeur explicite', () => {
    expect(resolveTrainingUxFlag('true')).toBe(true)
    expect(resolveTrainingUxFlag('1')).toBe(true)
    expect(resolveTrainingUxFlag('yes')).toBe(true)
    expect(resolveTrainingUxFlag('false')).toBe(false)
    expect(resolveTrainingUxFlag('0')).toBe(false)
  })

  it('DEV/test : défaut ON si unset (recommendations / sports)', () => {
    expect(resolveTrainingUxFlag(undefined)).toBe(true)
    expect(resolveTrainingUxFlag('')).toBe(true)
    expect(isTrainingRecommendationsEnabled(undefined)).toBe(true)
    expect(isSportsOnboardingEnabled(undefined)).toBe(true)
  })

  it('auto-set validation : unset/vide ⇒ ON (prod inclus) ; false explicite coupe', () => {
    expect(isAutoSetValidationEnabled(undefined)).toBe(true)
    expect(isAutoSetValidationEnabled('')).toBe(true)
    expect(isAutoSetValidationEnabled('   ')).toBe(true)
    expect(isAutoSetValidationEnabled('true')).toBe(true)
    expect(isAutoSetValidationEnabled('false')).toBe(false)
    expect(isAutoSetValidationEnabled('0')).toBe(false)
  })

  it('reste désactivable indépendamment', () => {
    expect(isTrainingRecommendationsEnabled('false')).toBe(false)
    expect(isAutoSetValidationEnabled('true')).toBe(true)
    expect(isSportsOnboardingEnabled('false')).toBe(false)
  })
})
