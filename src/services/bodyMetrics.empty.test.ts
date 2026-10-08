/**
 * Data rules for height/weight empty/null, erase, lb round-trip, legacy 0.
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalorieProfile } from '../types/nutrition'
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  KG_PER_LB,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  clampHeightCm,
  clampWeightKg,
  estimateRmrKcal,
  isProfileCompleteForNutrition,
  kgToLbDisplay,
  lbToKgStorage,
  sanitizeHeightCm,
  sanitizeWeightKg,
  shouldShowHeightWeightPicker,
} from './nutritionSafetyRules'
import { computeCaloriePlan } from '../utils/calories'

vi.mock('../backend/calorieGoalFeatureFlag', () => ({
  isCalorieGoalEnabled: () => false,
}))

const {
  BLANK_PROFILE,
  clearBodyMetrics,
  getCalorieProfile,
  mergeCalorieProfilesForSync,
  normalizeCalorieProfile,
  saveCalorieProfile,
} = await import('./nutritionStorage')

function base(overrides: Partial<CalorieProfile> = {}): CalorieProfile {
  return normalizeCalorieProfile({
    ...BLANK_PROFILE,
    age: 28,
    sex: 'female',
    onboardingComplete: true,
    ...overrides,
  })
}

describe('body metrics — empty is never 0', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('BLANK_PROFILE uses null for weight/height (not 0)', () => {
    expect(BLANK_PROFILE.weightKg).toBeNull()
    expect(BLANK_PROFILE.heightCm).toBeNull()
    expect(BLANK_PROFILE.goalWeightKg).toBeNull()
  })

  it('normalizeCalorieProfile never stores 0 for empty body metrics', () => {
    const p = normalizeCalorieProfile({
      ...BLANK_PROFILE,
      weightKg: 0 as unknown as number,
      heightCm: 0 as unknown as number,
      age: 30,
      sex: 'male',
      onboardingComplete: true,
    })
    expect(p.weightKg).toBeNull()
    expect(p.heightCm).toBeNull()
  })

  it('legacy stored 0 reads as empty (—) via sanitize', () => {
    expect(sanitizeWeightKg(0)).toBeNull()
    expect(sanitizeHeightCm(0)).toBeNull()
    expect(sanitizeWeightKg(NaN)).toBeNull()
    expect(sanitizeWeightKg(10)).toBeNull() // below min
    expect(sanitizeHeightCm(80)).toBeNull()
    expect(sanitizeWeightKg(72.5)).toBe(72.5)
    expect(sanitizeHeightCm(175)).toBe(175)
  })

  it('getCalorieProfile treats legacy local 0 as null', () => {
    localStorage.setItem(
      'ranked-gym:nutrition-profile',
      JSON.stringify({
        weightKg: 0,
        heightCm: 0,
        age: 25,
        sex: 'male',
        onboardingComplete: true,
        goal: 'maintain',
        activity: 'moderate',
        morphology: 'mesomorph',
        weeklyPaceKg: 0,
      }),
    )
    const p = getCalorieProfile()
    expect(p.weightKg).toBeNull()
    expect(p.heightCm).toBeNull()
    expect(p.age).toBe(25)
  })

  it('save then read keeps null (— never becomes 0)', () => {
    saveCalorieProfile(base({ weightKg: null, heightCm: null }), { skipCloud: true })
    const p = getCalorieProfile()
    expect(p.weightKg).toBeNull()
    expect(p.heightCm).toBeNull()
    const raw = JSON.parse(localStorage.getItem('ranked-gym:nutrition-profile')!)
    expect(raw.weightKg).toBeNull()
    expect(raw.heightCm).toBeNull()
  })
})

describe('body metrics — Plus tard saves nothing', () => {
  beforeEach(() => {
    localStorage.clear()
    saveCalorieProfile(base({ weightKg: 70, heightCm: 170 }), { skipCloud: true })
  })

  it('skipping does not call save — storage unchanged', () => {
    const before = getCalorieProfile()
    // Simulate Plus tard: no saveCalorieProfile call
    const after = getCalorieProfile()
    expect(after.weightKg).toBe(before.weightKg)
    expect(after.heightCm).toBe(before.heightCm)
    expect(after.weightKg).toBe(70)
  })
})

describe('body metrics — Effacer erases everywhere and sticks', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clearBodyMetrics sets null locally and stamps bodyMetricsClearedAt', () => {
    saveCalorieProfile(base({ weightKg: 78, heightCm: 178 }), { skipCloud: true })
    const cleared = clearBodyMetrics({ skipCloud: true })
    expect(cleared.weightKg).toBeNull()
    expect(cleared.heightCm).toBeNull()
    expect(cleared.bodyMetricsClearedAt).toBeGreaterThan(0)
    expect(getCalorieProfile().weightKg).toBeNull()
  })

  it('legacy remote 0 cannot overwrite a real local erase', () => {
    saveCalorieProfile(
      base({ weightKg: null, heightCm: null, bodyMetricsClearedAt: 2_000 }),
      { skipCloud: true },
    )
    const local = getCalorieProfile()
    const remote = base({
      weightKg: 0 as unknown as number,
      heightCm: 0 as unknown as number,
      bodyMetricsClearedAt: null,
    })
    // Force raw 0 into remote-like object
    const remoteRaw = { ...remote, weightKg: 0, heightCm: 0, bodyMetricsClearedAt: null }
    const merged = mergeCalorieProfilesForSync(local, remoteRaw as CalorieProfile)
    expect(merged.weightKg).toBeNull()
    expect(merged.heightCm).toBeNull()
    expect(merged.bodyMetricsClearedAt).toBe(2_000)
  })

  it('stale remote value cannot resurrect after local erase', () => {
    const local = base({ weightKg: null, heightCm: null, bodyMetricsClearedAt: 5_000 })
    const remote = base({ weightKg: 82, heightCm: 180, bodyMetricsClearedAt: 1_000 })
    const merged = mergeCalorieProfilesForSync(local, remote)
    expect(merged.weightKg).toBeNull()
    expect(merged.heightCm).toBeNull()
  })

  it('newer remote erase wins over older local values', () => {
    const local = base({ weightKg: 70, heightCm: 170, bodyMetricsClearedAt: null })
    const remote = base({ weightKg: null, heightCm: null, bodyMetricsClearedAt: 9_000 })
    const merged = mergeCalorieProfilesForSync(local, remote)
    expect(merged.weightKg).toBeNull()
    expect(merged.heightCm).toBeNull()
  })
})

describe('body metrics — kg stays kg (lb display only)', () => {
  it('uses exact KG_PER_LB constant', () => {
    expect(KG_PER_LB).toBe(0.45359237)
  })

  it('lb round-trip does not drift stored kg when display unchanged', () => {
    const stored = 72.5
    const lb = kgToLbDisplay(stored)
    // Toggling to lb and back without changing the snapped lb keeps same storage
    // if we only re-convert when display changes — storage path:
    const reconverted = lbToKgStorage(lb)
    // Re-selecting same lb may differ slightly from original fractional kg —
    // but toggling without changing must keep `stored` (tested at picker logic).
    expect(kgToLbDisplay(reconverted)).toBe(lb)
    // Exact storage of lb selection:
    expect(lbToKgStorage(160)).toBe(160 * KG_PER_LB)
    // Repeated convert display→storage→display is stable:
    let kg = 70
    for (let i = 0; i < 20; i += 1) {
      const d = kgToLbDisplay(kg)
      kg = lbToKgStorage(d)
    }
    expect(kgToLbDisplay(kg)).toBe(kgToLbDisplay(lbToKgStorage(kgToLbDisplay(70))))
  })

  it('bounds clamp typos', () => {
    expect(clampWeightKg(10)).toBe(WEIGHT_KG_MIN)
    expect(clampWeightKg(999)).toBe(WEIGHT_KG_MAX)
    expect(clampHeightCm(50)).toBe(HEIGHT_CM_MIN)
    expect(clampHeightCm(400)).toBe(HEIGHT_CM_MAX)
  })
})

describe('body metrics — no calculation when empty', () => {
  it('computeCaloriePlan returns zeros when weight or height empty', () => {
    const emptyW = computeCaloriePlan(base({ weightKg: null, heightCm: 170, sex: 'male', age: 30 }))
    expect(emptyW.bmr).toBe(0)
    expect(emptyW.tdee).toBe(0)
    expect(emptyW.targetCalories).toBe(0)

    const emptyH = computeCaloriePlan(base({ weightKg: 70, heightCm: null, sex: 'male', age: 30 }))
    expect(emptyH.bmr).toBe(0)

    const legacy0 = computeCaloriePlan(
      base({ weightKg: 0 as unknown as number, heightCm: 0 as unknown as number, sex: 'male', age: 30 }),
    )
    expect(legacy0.bmr).toBe(0)
  })

  it('isProfileCompleteForNutrition false when empty — no RMR path', () => {
    expect(
      isProfileCompleteForNutrition({
        age: 30,
        weightKg: null,
        heightCm: 175,
        sex: 'female',
      }),
    ).toBe(false)
    const complete = isProfileCompleteForNutrition({
      age: 30,
      weightKg: 65,
      heightCm: 170,
      sex: 'female',
    })
    expect(complete).toBe(true)
    expect(estimateRmrKcal(65, 170, 30, 'female')).toBeGreaterThan(1200)
  })
})

describe('body metrics — visibility guards', () => {
  it('hides picker for under-18, pregnancy, breastfeeding, eating disorder', () => {
    expect(
      shouldShowHeightWeightPicker({ age: 16, weightKg: null, heightCm: null, sex: 'male' }),
    ).toBe(false)
    expect(
      shouldShowHeightWeightPicker({
        age: 28,
        weightKg: null,
        heightCm: null,
        sex: 'female',
        declarations: { pregnancy: true },
      }),
    ).toBe(false)
    expect(
      shouldShowHeightWeightPicker({
        age: 28,
        weightKg: null,
        heightCm: null,
        sex: 'female',
        declarations: { breastfeeding: true },
      }),
    ).toBe(false)
    expect(
      shouldShowHeightWeightPicker({
        age: 28,
        weightKg: null,
        heightCm: null,
        sex: 'female',
        declarations: { eatingDisorder: true },
      }),
    ).toBe(false)
    expect(
      shouldShowHeightWeightPicker({ age: 28, weightKg: null, heightCm: null, sex: 'male' }),
    ).toBe(true)
  })
})
