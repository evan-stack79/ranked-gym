import { describe, expect, it } from 'vitest'
import {
  ABSOLUTE_CALORIE_FLOOR,
  clampWeeklyPaceKg,
  computeBmi,
  decideEstimationEligibility,
  decideLossEligibility,
  defaultWeeklyPaceKg,
  effectiveCalorieFloor,
  estimateRmrKcal,
  evaluateCalorieTarget,
  isMinorAge,
  isMinorOrUnknownAge,
  isValidAge,
  maxWeeklyPaceKg,
  maxWeeklyPaceKgWithDeficit,
  MAX_DAILY_DEFICIT_KCAL,
  softBandMessage,
} from './nutritionSafetyRules'
import { applySafetyToProfile } from './nutritionSafetyRules'
import type { CalorieProfile } from '../types/nutrition'

const adultBase = {
  age: 30,
  weightKg: 70,
  heightCm: 175,
  sex: 'female' as const,
}

describe('Âge — éligibilité', () => {
  it('17 → mineur : aucune perte / estimation', () => {
    expect(isMinorAge(17)).toBe(true)
    const loss = decideLossEligibility({ ...adultBase, age: 17 }, { calorieGoalEnabled: true })
    expect(loss.eligible).toBe(false)
    expect(loss.reason).toBe('minor')
    const est = decideEstimationEligibility({ ...adultBase, age: 17 }, { calorieGoalEnabled: true })
    expect(est.allowed).toBe(false)
  })

  it('18 → estimation sans perte', () => {
    expect(isMinorAge(18)).toBe(false)
    const loss = decideLossEligibility({ ...adultBase, age: 18 }, { calorieGoalEnabled: true })
    expect(loss.eligible).toBe(false)
    expect(loss.reason).toBe('age_18_no_loss')
    const est = decideEstimationEligibility({ ...adultBase, age: 18 }, { calorieGoalEnabled: true })
    expect(est.allowed).toBe(true)
    expect(est.disclaimer).toMatch(/18 ans/)
  })

  it('19 et 75 → perte OK (drapeau ON)', () => {
    expect(decideLossEligibility({ ...adultBase, age: 19 }, { calorieGoalEnabled: true }).eligible).toBe(true)
    expect(decideLossEligibility({ ...adultBase, age: 75 }, { calorieGoalEnabled: true }).eligible).toBe(true)
  })

  it('76 → aucune perte ; 78 estimation ; 79 mention renforcée', () => {
    expect(decideLossEligibility({ ...adultBase, age: 76 }, { calorieGoalEnabled: true }).reason).toBe(
      'age_over_75_no_loss',
    )
    const e78 = decideEstimationEligibility({ ...adultBase, age: 78 }, { calorieGoalEnabled: true })
    expect(e78.allowed).toBe(true)
    const e79 = decideEstimationEligibility({ ...adultBase, age: 79 }, { calorieGoalEnabled: true })
    expect(e79.allowed).toBe(true)
    expect(e79.disclaimer).toMatch(/n'a pas été validée/)
  })

  it('âge inconnu / NaN / 0 / 121', () => {
    expect(isValidAge(Number.NaN)).toBe(false)
    expect(isValidAge(0)).toBe(false)
    expect(isValidAge(121)).toBe(false)
    expect(isMinorOrUnknownAge(undefined)).toBe(true)
    expect(
      decideLossEligibility({ ...adultBase, age: Number.NaN }, { calorieGoalEnabled: true }).reason,
    ).toBe('incomplete_profile')
  })
})

describe('IMC', () => {
  it('18,49 refusé / 18,5 accepté (< 70 ans)', () => {
    const h = 170
    const wLow = 18.49 * (1.7 * 1.7)
    const wOk = 18.5 * (1.7 * 1.7)
    expect(computeBmi(wLow, h)!).toBeLessThan(18.5)
    expect(
      decideLossEligibility({ ...adultBase, age: 30, heightCm: h, weightKg: wLow }, { calorieGoalEnabled: true })
        .eligible,
    ).toBe(false)
    expect(
      decideLossEligibility({ ...adultBase, age: 30, heightCm: h, weightKg: wOk }, { calorieGoalEnabled: true })
        .eligible,
    ).toBe(true)
  })

  it('âge ≥ 70 : 21,99 refusé / 22 accepté (HAS)', () => {
    const h = 170
    const wLow = 21.99 * (1.7 * 1.7)
    const wOk = 22 * (1.7 * 1.7)
    expect(
      decideLossEligibility({ ...adultBase, age: 70, heightCm: h, weightKg: wLow }, { calorieGoalEnabled: true })
        .eligible,
    ).toBe(false)
    expect(
      decideLossEligibility({ ...adultBase, age: 70, heightCm: h, weightKg: wOk }, { calorieGoalEnabled: true })
        .eligible,
    ).toBe(true)
  })

  it('poids cible IMC 18,49 refusé / 18,5 accepté', () => {
    const h = 170
    const current = 70
    const targetLow = 18.49 * (1.7 * 1.7)
    const targetOk = 18.5 * (1.7 * 1.7)
    expect(
      decideLossEligibility(
        { ...adultBase, weightKg: current, heightCm: h, goalWeightKg: targetLow },
        { calorieGoalEnabled: true },
      ).reason,
    ).toBe('low_target_bmi')
    expect(
      decideLossEligibility(
        { ...adultBase, weightKg: current, heightCm: h, goalWeightKg: targetOk },
        { calorieGoalEnabled: true },
      ).eligible,
    ).toBe(true)
  })
})

describe('Plancher calorique et déficit', () => {
  it('1199 refusé / 1200 accepté ; RMR−1 refusé / RMR accepté', () => {
    const rmr = estimateRmrKcal(70, 175, 30, 'female')
    const floor = effectiveCalorieFloor(rmr)
    expect(floor).toBeGreaterThanOrEqual(ABSOLUTE_CALORIE_FLOOR)

    const low = evaluateCalorieTarget({
      targetCalories: 1199,
      maintenanceKcal: 2500,
      rmrKcal: 1100,
      mode: 'reject',
    })
    expect(low.ok).toBe(false)

    // 1200 accepté si déficit ≤ 600 (entretien 1800) et ≥ RMR
    const ok1200 = evaluateCalorieTarget({
      targetCalories: 1200,
      maintenanceKcal: 1800,
      rmrKcal: 1100,
      mode: 'reject',
    })
    expect(ok1200.ok).toBe(true)

    const maintenanceNearRmr = rmr + MAX_DAILY_DEFICIT_KCAL
    const belowRmr = evaluateCalorieTarget({
      targetCalories: rmr - 1,
      maintenanceKcal: maintenanceNearRmr,
      rmrKcal: rmr,
      mode: 'reject',
    })
    expect(belowRmr.ok).toBe(false)

    const atRmr = evaluateCalorieTarget({
      targetCalories: Math.max(rmr, ABSOLUTE_CALORIE_FLOOR),
      maintenanceKcal: Math.max(rmr, ABSOLUTE_CALORIE_FLOOR) + MAX_DAILY_DEFICIT_KCAL,
      rmrKcal: rmr,
      mode: 'reject',
    })
    expect(atRmr.ok).toBe(true)
  })

  it('1499 → mention soft ; 1500 → pas de mention', () => {
    expect(softBandMessage(1499)).toMatch(/professionnel de santé/)
    expect(softBandMessage(1500)).toBeNull()
  })

  it('déficit 600 accepté / 601 ramené', () => {
    const ok = evaluateCalorieTarget({
      targetCalories: 2000,
      maintenanceKcal: 2600,
      rmrKcal: 1400,
      mode: 'reject',
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.deficitKcal).toBe(600)

    const clamped = evaluateCalorieTarget({
      targetCalories: 1999,
      maintenanceKcal: 2600,
      rmrKcal: 1400,
      mode: 'clamp',
    })
    expect(clamped.ok).toBe(true)
    if (clamped.ok) {
      expect(clamped.deficitKcal).toBeLessThanOrEqual(MAX_DAILY_DEFICIT_KCAL)
      expect(clamped.targetCalories).toBe(2000)
    }
  })

  it('propriété : cible ≥ max(1200,RMR) et déficit ≤ 600', () => {
    const profiles = [
      { w: 55, h: 160, a: 25, s: 'female' as const, maint: 2100 },
      { w: 70, h: 175, a: 30, s: 'male' as const, maint: 2800 },
      { w: 90, h: 180, a: 40, s: 'male' as const, maint: 3200 },
      { w: 100, h: 170, a: 45, s: 'female' as const, maint: 2600 },
    ]
    for (const p of profiles) {
      const rmr = estimateRmrKcal(p.w, p.h, p.a, p.s)
      const aggressive = evaluateCalorieTarget({
        targetCalories: 800,
        maintenanceKcal: p.maint,
        rmrKcal: rmr,
        mode: 'clamp',
      })
      expect(aggressive.ok).toBe(true)
      if (!aggressive.ok) continue
      expect(aggressive.targetCalories).toBeGreaterThanOrEqual(Math.max(1200, rmr))
      expect(aggressive.deficitKcal).toBeLessThanOrEqual(600)
    }
  })
})

describe('Vitesse de perte', () => {
  it('défaut 0,5 % ; plafonds 60/90/100/120 kg', () => {
    expect(defaultWeeklyPaceKg(60)).toBeCloseTo(0.3, 5)
    expect(maxWeeklyPaceKg(60)).toBeCloseTo(0.6, 5)
    expect(maxWeeklyPaceKg(90)).toBeCloseTo(0.9, 5)
    expect(maxWeeklyPaceKg(100)).toBeCloseTo(0.9, 5)
    expect(maxWeeklyPaceKg(120)).toBeCloseTo(0.9, 5)
  })

  it('0,9 accepté / 0,91 ramené ; 1,5 stocké ramené ; déficit 600 borne', () => {
    expect(clampWeeklyPaceKg(0.9, 100)).toBeLessThanOrEqual(0.9)
    expect(clampWeeklyPaceKg(0.91, 100)).toBeLessThanOrEqual(0.9)
    expect(clampWeeklyPaceKg(1.5, 80)).toBeLessThanOrEqual(maxWeeklyPaceKgWithDeficit(80))
    // 600 kcal/j ≈ 0.545 kg/sem < 0.9
    expect(maxWeeklyPaceKgWithDeficit(120)).toBeLessThan(0.9)
  })
})

describe('Populations déclarées', () => {
  it('grossesse / allaitement / TCA → aucune perte ; grossesse sans estimation', () => {
    expect(
      decideLossEligibility(
        { ...adultBase, declarations: { pregnancy: true } },
        { calorieGoalEnabled: true },
      ).eligible,
    ).toBe(false)
    expect(
      decideEstimationEligibility(
        { ...adultBase, declarations: { breastfeeding: true } },
        { calorieGoalEnabled: true },
      ).allowed,
    ).toBe(false)
    expect(
      decideLossEligibility(
        { ...adultBase, declarations: { eatingDisorder: true } },
        { calorieGoalEnabled: true },
      ).reason,
    ).toBe('eating_disorder')
  })

  it('Je préfère ne pas répondre → pas de restriction supplémentaire', () => {
    const loss = decideLossEligibility(
      { ...adultBase, declarations: { preferNotToAnswer: true } },
      { calorieGoalEnabled: true },
    )
    expect(loss.eligible).toBe(true)
  })

  it('sexe manquant → profil incomplet (pas de défaut homme)', () => {
    const profile: CalorieProfile = {
      weightKg: 70,
      goalWeightKg: 65,
      heightCm: 170,
      age: 30,
      sex: null,
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'cut',
      weeklyPaceKg: 0.5,
      onboardingComplete: true,
    }
    const next = applySafetyToProfile(profile, { calorieGoalEnabled: true })
    expect(next.sex).toBeNull()
    expect(
      decideLossEligibility(
        { age: 30, weightKg: 70, heightCm: 170, sex: null },
        { calorieGoalEnabled: true },
      ).reason,
    ).toBe('incomplete_profile')
  })
})

describe('Interrupteur calorie goal', () => {
  it('drapeau OFF → aucune perte', () => {
    expect(decideLossEligibility(adultBase, { calorieGoalEnabled: false }).reason).toBe(
      'calorie_goal_disabled',
    )
  })

  it('drapeau ON → règles A2 s’appliquent', () => {
    expect(decideLossEligibility({ ...adultBase, age: 17 }, { calorieGoalEnabled: true }).eligible).toBe(
      false,
    )
    expect(decideLossEligibility(adultBase, { calorieGoalEnabled: true }).eligible).toBe(true)
  })
})
