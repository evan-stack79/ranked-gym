/**
 * Architect + Verifier rules for one-question inscription.
 */
import { describe, expect, it } from 'vitest'
import type { CalorieProfile } from '../types/nutrition'
import {
  BLANK_PROFILE,
  mergeCalorieProfilesForSync,
  normalizeCalorieProfile,
} from './nutritionStorage'
import {
  decideEstimationEligibility,
  effectivePregnancyBreastfeeding,
  PLAUSIBLE_AGE_MAX,
  PLAUSIBLE_AGE_MIN,
  readHealthAnswer,
  sanitizeAge,
  shouldShowPregnancyBreastfeedingChoices,
  shouldShowWeightScreen,
  shouldShowHeightWeightPicker,
} from './nutritionSafetyRules'
import {
  buildInscriptionSteps,
  computeInscriptionProgress,
  type DraftAnswers,
} from '../components/onboarding/InscriptionFlow'

function base(over: Partial<CalorieProfile> = {}): CalorieProfile {
  return normalizeCalorieProfile({
    ...BLANK_PROFILE,
    age: 28,
    sex: 'female',
    heightCm: 170,
    weightKg: 65,
    onboardingComplete: true,
    healthAnswer: 'none',
    healthAnswerUpdatedAt: 1000,
    sexUpdatedAt: 1000,
    ...over,
  })
}

describe('age bounds (existing app constants)', () => {
  it('reports PLAUSIBLE_AGE_MIN/MAX = 10 / 120', () => {
    expect(PLAUSIBLE_AGE_MIN).toBe(10)
    expect(PLAUSIBLE_AGE_MAX).toBe(120)
  })

  it('sanitizeAge: empty/0/legacy → null, never treats 0 as real age', () => {
    expect(sanitizeAge(0)).toBeNull()
    expect(sanitizeAge(null)).toBeNull()
    expect(sanitizeAge(undefined)).toBeNull()
    expect(sanitizeAge(24)).toBe(24)
    expect(sanitizeAge(9)).toBeNull()
    expect(sanitizeAge(121)).toBeNull()
  })
})

describe('sex 3 distinct answers + empty', () => {
  it('stores prefer_not_to_say distinctly (never coerced to male/female)', () => {
    const p = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      sex: 'prefer_not_to_say',
      sexUpdatedAt: 50,
    })
    expect(p.sex).toBe('prefer_not_to_say')
    expect(p.sex).not.toBe('male')
    expect(p.sex).not.toBe('female')
  })

  it('null sex (Plus tard) stays null', () => {
    const p = normalizeCalorieProfile({ ...BLANK_PROFILE, sex: null })
    expect(p.sex).toBeNull()
  })

  it('legacy male/female still normalize', () => {
    expect(normalizeCalorieProfile({ ...BLANK_PROFILE, sex: 'male' }).sex).toBe('male')
    expect(normalizeCalorieProfile({ ...BLANK_PROFILE, sex: 'female' }).sex).toBe('female')
  })

  it('prefer_not_to_say survives sync — newest wins over older male/female', () => {
    const local = base({
      sex: 'prefer_not_to_say',
      sexUpdatedAt: 5000,
    })
    const remote = base({
      sex: 'male',
      sexUpdatedAt: 1000,
    })
    const merged = mergeCalorieProfilesForSync(local, remote)
    expect(merged.sex).toBe('prefer_not_to_say')
    expect(merged.sexUpdatedAt).toBe(5000)
  })

  it('older prefer_not_to_say does not overwrite newer female', () => {
    const local = base({ sex: 'prefer_not_to_say', sexUpdatedAt: 100 })
    const remote = base({ sex: 'female', sexUpdatedAt: 9000 })
    expect(mergeCalorieProfilesForSync(local, remote).sex).toBe('female')
  })

  it('prefer_not_to_say and null both show Grossesse/Allaitement', () => {
    expect(shouldShowPregnancyBreastfeedingChoices('prefer_not_to_say')).toBe(true)
    expect(shouldShowPregnancyBreastfeedingChoices(null)).toBe(true)
    expect(shouldShowPregnancyBreastfeedingChoices('female')).toBe(true)
    expect(shouldShowPregnancyBreastfeedingChoices('male')).toBe(false)
  })

  it('prefer_not_to_say and null allow NO Mifflin estimate', () => {
    for (const sex of ['prefer_not_to_say', null] as const) {
      const r = decideEstimationEligibility(
        {
          age: 28,
          sex,
          heightCm: 170,
          weightKg: 65,
          healthAnswer: 'none',
        },
        { calorieGoalEnabled: true },
      )
      expect(r.allowed).toBe(false)
    }
  })
})

describe('healthAnswer 3 states', () => {
  it('missing healthAnswer → not answered (never « none »)', () => {
    expect(readHealthAnswer({ ...BLANK_PROFILE })).toBeNull()
    expect(readHealthAnswer(base({ healthAnswer: null }))).toBeNull()
  })

  it('none / prefer_not / situations are distinct', () => {
    expect(readHealthAnswer(base({ healthAnswer: 'none' }))).toBe('none')
    expect(readHealthAnswer(base({ healthAnswer: 'prefer_not' }))).toBe('prefer_not')
    expect(readHealthAnswer(base({ healthAnswer: 'situations' }))).toBe('situations')
  })

  it('Plus tard (null) ≠ Aucune (none) on sync — missing stays missing', () => {
    const local = base({ healthAnswer: null, healthAnswerUpdatedAt: null })
    const remote = base({ healthAnswer: null, healthAnswerUpdatedAt: null })
    expect(mergeCalorieProfilesForSync(local, remote).healthAnswer).toBeNull()
  })

  it('newest healthAnswer wins on merge', () => {
    const local = base({
      healthAnswer: 'prefer_not',
      healthAnswerUpdatedAt: 8000,
      declaredPregnancy: false,
    })
    const remote = base({
      healthAnswer: 'none',
      healthAnswerUpdatedAt: 1000,
    })
    expect(mergeCalorieProfilesForSync(local, remote).healthAnswer).toBe('prefer_not')
  })
})

describe('Mifflin gates', () => {
  it('computes only when healthAnswer=none, age>=18, sex male|female, height+weight', () => {
    const ok = decideEstimationEligibility(
      {
        age: 28,
        sex: 'female',
        heightCm: 170,
        weightKg: 65,
        healthAnswer: 'none',
      },
      { calorieGoalEnabled: true },
    )
    expect(ok.allowed).toBe(true)
  })

  it('no estimate when healthAnswer is prefer_not or null', () => {
    expect(
      decideEstimationEligibility(
        { age: 28, sex: 'female', heightCm: 170, weightKg: 65, healthAnswer: 'prefer_not' },
        { calorieGoalEnabled: true },
      ).allowed,
    ).toBe(false)
    expect(
      decideEstimationEligibility(
        { age: 28, sex: 'female', heightCm: 170, weightKg: 65, healthAnswer: null },
        { calorieGoalEnabled: true },
      ).allowed,
    ).toBe(false)
  })

  it('no estimate without age', () => {
    expect(
      decideEstimationEligibility(
        { age: 0, sex: 'female', heightCm: 170, weightKg: 65, healthAnswer: 'none' },
        { calorieGoalEnabled: true },
      ).allowed,
    ).toBe(false)
  })
})

describe('stale Grossesse after sex → male', () => {
  it('sets Grossesse, switches to male, syncs — pregnancy no longer blocks; TCA still does', () => {
    // 1) Female + Grossesse
    const withPregnancy = base({
      sex: 'female',
      sexUpdatedAt: 1000,
      healthAnswer: 'situations',
      healthAnswerUpdatedAt: 1000,
      declaredPregnancy: true,
      declaredBreastfeeding: false,
      declaredEatingDisorder: false,
    })
    expect(effectivePregnancyBreastfeeding(withPregnancy).pregnancy).toBe(true)
    expect(shouldShowWeightScreen(withPregnancy)).toBe(false)
    expect(shouldShowHeightWeightPicker(withPregnancy)).toBe(false)
    expect(
      decideEstimationEligibility(withPregnancy, { calorieGoalEnabled: true }).allowed,
    ).toBe(false)

    // 2) Later answers male (newer sexUpdatedAt), pregnancy flags still present in storage
    const switchedMale = normalizeCalorieProfile({
      ...withPregnancy,
      sex: 'male',
      sexUpdatedAt: 9000,
      // stale flags intentionally kept
      declaredPregnancy: true,
      healthAnswer: 'situations',
    })
    expect(effectivePregnancyBreastfeeding(switchedMale).pregnancy).toBe(false)
    expect(shouldShowWeightScreen(switchedMale)).toBe(true)
    expect(shouldShowHeightWeightPicker(switchedMale)).toBe(true)

    // 3) Sync with online copy that still has older female + pregnancy
    const remoteStale = base({
      sex: 'female',
      sexUpdatedAt: 1000,
      healthAnswer: 'situations',
      healthAnswerUpdatedAt: 1000,
      declaredPregnancy: true,
    })
    const merged = mergeCalorieProfilesForSync(switchedMale, remoteStale)
    expect(merged.sex).toBe('male')
    expect(effectivePregnancyBreastfeeding(merged).pregnancy).toBe(false)
    expect(shouldShowWeightScreen(merged)).toBe(true)
    expect(shouldShowHeightWeightPicker(merged)).toBe(true)

    // TCA still blocks regardless of sex
    const withTca = normalizeCalorieProfile({
      ...switchedMale,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    expect(shouldShowWeightScreen(withTca)).toBe(false)
    expect(shouldShowHeightWeightPicker(withTca)).toBe(false)
    expect(
      decideEstimationEligibility(withTca, { calorieGoalEnabled: true }).allowed,
    ).toBe(false)
  })
})

describe('weight screen + progress bar', () => {
  it('hides weight for <18 or situation ticked', () => {
    expect(
      shouldShowWeightScreen({
        age: 16,
        sex: 'female',
        heightCm: 170,
        weightKg: null,
        healthAnswer: 'none',
      }),
    ).toBe(false)
    expect(
      shouldShowWeightScreen({
        age: 28,
        sex: 'female',
        heightCm: 170,
        weightKg: null,
        healthAnswer: 'situations',
        declarations: {
          pregnancy: false,
          breastfeeding: false,
          eatingDisorder: true,
          preferNotToAnswer: false,
        },
      }),
    ).toBe(false)
  })

  it('shows weight for Santé prefer_not / Plus tard (no estimate)', () => {
    expect(
      shouldShowWeightScreen({
        age: 28,
        sex: 'female',
        heightCm: 170,
        weightKg: null,
        healthAnswer: 'prefer_not',
      }),
    ).toBe(true)
    expect(
      shouldShowWeightScreen({
        age: 28,
        sex: 'female',
        heightCm: 170,
        weightKg: null,
        healthAnswer: null,
      }),
    ).toBe(true)
  })

  it('progress steps omit weight when hidden and still end at ready', () => {
    const adultNone: DraftAnswers = {
      age: 28,
      sex: 'female',
      healthAnswer: 'none',
      pregnancy: false,
      breastfeeding: false,
      eatingDisorder: false,
      heightCm: 170,
      weightKg: null,
    }
    expect(buildInscriptionSteps(adultNone)).toEqual([
      'welcome',
      'age',
      'sex',
      'health',
      'height',
      'weight',
      'ready',
    ])

    const withTca: DraftAnswers = {
      ...adultNone,
      healthAnswer: 'situations',
      eatingDisorder: true,
    }
    const steps = buildInscriptionSteps(withTca)
    expect(steps).toEqual(['welcome', 'age', 'sex', 'health', 'height', 'ready'])
    expect(steps[steps.length - 1]).toBe('ready')
    expect(steps.includes('weight')).toBe(false)
  })

  it('progress bar advances past Poids and is 100% on C’est prêt', () => {
    const adultNone: DraftAnswers = {
      age: 28,
      sex: 'female',
      healthAnswer: 'none',
      pregnancy: false,
      breastfeeding: false,
      eatingDisorder: false,
      heightCm: 170,
      weightKg: 65,
    }
    const steps = buildInscriptionSteps(adultNone)
    const onWeight = computeInscriptionProgress('weight', steps)
    const onReady = computeInscriptionProgress('ready', steps)
    expect(onReady).toBe(1)
    expect(onWeight).toBeLessThan(1)
    expect(onWeight).toBeGreaterThan(computeInscriptionProgress('height', steps))
    expect(computeInscriptionProgress('welcome', steps)).toBe(0)

    const tcaSteps = buildInscriptionSteps({
      ...adultNone,
      healthAnswer: 'situations',
      eatingDisorder: true,
    })
    expect(computeInscriptionProgress('ready', tcaSteps)).toBe(1)
    expect(computeInscriptionProgress('height', tcaSteps)).toBeLessThan(1)
  })
})
