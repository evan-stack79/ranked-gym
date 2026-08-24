import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  allocateWaterfall,
  computeBcmrKcal,
  computeEer,
  macrosToKcal,
  resolveMacroConstraints,
  resolveSportFlags,
  runNutritionEngine,
  runNutritionEngineWithTarget,
} from './index'
import type { NutritionEngineInput } from './types'

const BASE_INPUT: NutritionEngineInput = {
  sex: 'male',
  age: 30,
  weight_kg: 50,
  height_m: 1.75,
  activity: 2,
  goal: 'maintain',
  deficit_kcal: 0,
  surplus_kcal: 0,
  sport_principal: null,
  sport_secondaire: null,
  duration_h: 0,
  effort_fluid_loss_l: 0,
}

function floorsFor(input: NutritionEngineInput, targetKcal: number) {
  const flags = resolveSportFlags(input.sport_principal, input.sport_secondaire)
  return resolveMacroConstraints(input.weight_kg, flags, input.goal, targetKcal)
}

describe('EER IOM', () => {
  it('utilise les équations IOM sans calories brûlées', () => {
    const eer = computeEer({
      sex: 'male',
      age: 30,
      weight_kg: 80,
      height_m: 1.8,
      activity: 3,
    })
    // 662 - 9.53*30 + 1.25*(15.91*80 + 539.6*1.8)
    expect(eer).toBeCloseTo(662 - 285.9 + 1.25 * (1272.8 + 971.28), 2)
  })
})

describe('BCMR gate', () => {
  it('Target_Kcal = BCMR réussit (macros aux planchers)', () => {
    const constraints = floorsFor(BASE_INPUT, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(BASE_INPUT, bcmr)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.macros.proteines_g).toBeCloseTo(constraints.prot_min_g, 6)
    expect(result.macros.lipides_g).toBeCloseTo(constraints.lip_min_g, 6)
    expect(result.macros.glucides_g).toBeCloseTo(constraints.gluc_min_g, 6)
  })

  it('Target_Kcal = BCMR - 1 → ERR_TARGET_BELOW_BCMR (422)', () => {
    const constraints = floorsFor(BASE_INPUT, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(BASE_INPUT, bcmr - 1)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
    expect(result.httpStatus).toBe(422)
  })

  it('Target_Kcal = BCMR + 20 distribue via Waterfall (glucides si prot/lip saturés)', () => {
    const flags = resolveSportFlags(null, null)
    const probe = resolveMacroConstraints(BASE_INPUT.weight_kg, flags, BASE_INPUT.goal, 1000)
    const bcmr = computeBcmrKcal(probe)
    const target = bcmr + 20
    const constraints = resolveMacroConstraints(BASE_INPUT.weight_kg, flags, BASE_INPUT.goal, target)

    const before = allocateWaterfall(bcmr, constraints)
    const after = allocateWaterfall(target, constraints)

    expect(after.macros.proteines_g).toBeCloseTo(before.macros.proteines_g, 6)
    expect(after.macros.lipides_g).toBeCloseTo(before.macros.lipides_g, 6)
    expect(after.macros.glucides_g - before.macros.glucides_g).toBeCloseTo(5, 6)

    const kcal = macrosToKcal(after.macros)
    expect(kcal.total_kcal).toBeCloseTo(target, 2)
  })
})

describe('Sports combinés', () => {
  it('musculation + cut → Prot_Min 2.4 g/kg', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 80,
      goal: 'cut',
      sport_principal: 'musculation',
      deficit_kcal: 300,
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.prot_min_g).toBeCloseTo(80 * 2.4, 6)
  })

  it('endurance → Gluc_Min 6 g/kg', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      sport_principal: 'velo',
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.gluc_min_g).toBeCloseTo(50 * 6, 6)
  })

  it('profil non-endurance peut avoir Gluc_Min = 0', () => {
    const result = runNutritionEngine(BASE_INPUT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.gluc_min_g).toBe(0)
  })
})

describe('130 kg — plancher lipidique et BCMR', () => {
  it('Lip_Min = 65 g (585 kcal) et BCMR vérifié avant allocation', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 130,
      goal: 'cut',
      sport_principal: 'musculation',
      deficit_kcal: 0,
    }
    const flags = resolveSportFlags('musculation', null)
    const constraints = resolveMacroConstraints(130, flags, 'cut', 5000)
    expect(constraints.lip_min_g).toBeCloseTo(65, 6)
    expect(constraints.prot_min_g).toBeCloseTo(130 * 2.4, 6)

    const bcmr = computeBcmrKcal(constraints)
    expect(bcmr).toBeCloseTo(130 * 2.4 * 4 + 65 * 9, 2)

    const tooLow = runNutritionEngineWithTarget(input, bcmr - 1)
    expect(tooLow.ok).toBe(false)
    if (tooLow.ok) return
    expect(tooLow.code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
  })
})

describe('Conservation énergétique', () => {
  it('Prot×4 + Lip×9 + Gluc×4 ≈ Target_Kcal', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 70,
      goal: 'bulk',
      surplus_kcal: 400,
      sport_principal: 'football',
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const total =
      result.macros_kcal.proteines_kcal +
      result.macros_kcal.lipides_kcal +
      result.macros_kcal.glucides_kcal
    expect(Math.abs(total - result.target_kcal)).toBeLessThanOrEqual(3)
  })
})

describe('Validation entrées', () => {
  it('âge hors plage → ERR_INVALID_AGE', () => {
    const result = runNutritionEngine({ ...BASE_INPUT, age: 17 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.INVALID_AGE)
  })
})

describe('Recommandations UI', () => {
  it('n’altère pas target_kcal ni macros', () => {
    const withRec = runNutritionEngine({
      ...BASE_INPUT,
      duration_h: 2,
      effort_fluid_loss_l: 1.2,
    })
    const withoutRec = runNutritionEngine({
      ...BASE_INPUT,
      duration_h: 0,
      effort_fluid_loss_l: 0,
    })
    expect(withRec.ok && withoutRec.ok).toBe(true)
    if (!withRec.ok || !withoutRec.ok) return
    expect(withRec.recommendations.length).toBeGreaterThan(0)
    expect(withRec.target_kcal).toBe(withoutRec.target_kcal)
    expect(withRec.macros).toEqual(withoutRec.macros)
  })
})

describe('Objectif calorique', () => {
  it('maintien = EER, perte = EER - déficit, prise = EER + surplus', () => {
    const eer = computeEer({
      sex: BASE_INPUT.sex,
      age: BASE_INPUT.age,
      weight_kg: BASE_INPUT.weight_kg,
      height_m: BASE_INPUT.height_m,
      activity: BASE_INPUT.activity,
    })

    const maintain = runNutritionEngine({ ...BASE_INPUT, goal: 'maintain' })
    const cut = runNutritionEngine({ ...BASE_INPUT, goal: 'cut', deficit_kcal: 500 })
    const bulk = runNutritionEngine({ ...BASE_INPUT, goal: 'bulk', surplus_kcal: 300 })

    expect(maintain.ok && cut.ok && bulk.ok).toBe(true)
    if (!maintain.ok || !cut.ok || !bulk.ok) return

    expect(maintain.target_kcal).toBeCloseTo(eer, 6)
    expect(cut.target_kcal).toBeCloseTo(eer - 500, 6)
    expect(bulk.target_kcal).toBeCloseTo(eer + 300, 6)
  })
})
