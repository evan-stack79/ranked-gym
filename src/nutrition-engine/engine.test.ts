import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  allocateWaterfall,
  buildRecommendations,
  computeBcmrKcal,
  computeEer,
  formatApiPayload,
  macrosToKcal,
  resolveMacroConstraints,
  resolveProteinMinGPerKg,
  resolveProteinTargetGPerKg,
  resolveSportFlags,
  runNutritionEngine,
  runNutritionEngineWithTarget,
  validateForbiddenActivityFields,
} from './index.ts'
import type { NutritionEngineInput } from './types.ts'

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
  intensity: null,
  effort_weight_loss_kg: 0,
  effort_fluid_loss_l: 0,
}

function floorsFor(input: NutritionEngineInput, targetKcal: number) {
  const flags = resolveSportFlags(input.sport_principal, input.sport_secondaire)
  return resolveMacroConstraints(
    input.weight_kg,
    flags,
    input.goal,
    targetKcal,
    input.sport_principal,
    input.sport_secondaire,
  )
}

function macroTotal(result: Extract<ReturnType<typeof runNutritionEngine>, { ok: true }>) {
  return (
    result.macros_kcal.proteines_kcal +
    result.macros_kcal.lipides_kcal +
    result.macros_kcal.glucides_kcal
  )
}

describe('Test 1 — Maintien standard', () => {
  it('homme 80 kg niveau 3 musculation — conservation calorique', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 80,
      activity: 3,
      sport_principal: 'musculation',
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.abs(macroTotal(result) - result.target_kcal)).toBeLessThanOrEqual(3)
  })
})

describe('Test 2 — Force + Endurance', () => {
  it('musculation + endurance en perte — Prot_Min 2.4 et Gluc_Min 6 g/kg', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 70,
      activity: 3,
      goal: 'cut',
      deficit_kcal: 200,
      sport_principal: 'musculation',
      sport_secondaire: 'course-a-pied',
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.prot_min_g).toBeCloseTo(70 * 2.4, 6)
    expect(result.constraints.gluc_min_g).toBeCloseTo(70 * 6, 6)
    expect(result.constraints.prot_target_g).toBeCloseTo(70 * 2.4, 6)
  })
})

describe('Test 3 — BCMR hard stop', () => {
  it('femme 50 kg endurance déficit agressif → ERR_TARGET_BELOW_BCMR', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      sex: 'female',
      weight_kg: 50,
      sport_principal: 'velo',
      goal: 'cut',
      deficit_kcal: 2000,
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
    expect(result.httpStatus).toBe(422)
  })
})

describe('Test 4 — Waterfall edge BCMR + 20', () => {
  it('priorise les protéines, lipides/glucides au minimum', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 80,
      sport_principal: 'musculation',
    }
    const constraints = floorsFor(input, 5000)
    const bcmr = computeBcmrKcal(constraints)
    const target = bcmr + 20
    const atTarget = resolveMacroConstraints(
      80,
      resolveSportFlags('musculation', null),
      'maintain',
      target,
      'musculation',
      null,
    )
    const before = allocateWaterfall(bcmr, atTarget)
    const after = allocateWaterfall(target, atTarget)

    expect(after.macros.proteines_g - before.macros.proteines_g).toBeCloseTo(5, 6)
    expect(after.macros.lipides_g).toBeCloseTo(before.macros.lipides_g, 6)
    expect(after.macros.glucides_g).toBeCloseTo(before.macros.glucides_g, 6)
    expect(macrosToKcal(after.macros).total_kcal).toBeCloseTo(target, 2)
  })
})

describe('Test 5 — Plancher lipidique 130 kg', () => {
  it('Lip_Min = 65 g même si 25 % Target est inférieur', () => {
    const flags = resolveSportFlags('musculation', null)
    const constraints = resolveMacroConstraints(130, flags, 'cut', 5000, 'musculation', null)
    expect(constraints.lip_min_g).toBeCloseTo(65, 6)
    expect(constraints.prot_min_g).toBeCloseTo(130 * 2.4, 6)
  })
})

describe('Test 6 — Anti-double-comptage moteur', () => {
  it('steps/workout absents du contrat — résultat identique', () => {
    const input: NutritionEngineInput = {
      ...BASE_INPUT,
      weight_kg: 75,
      activity: 3,
      sport_principal: 'musculation',
    }
    const a = runNutritionEngine(input)
    const b = runNutritionEngine({ ...input })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(b.target_kcal).toBe(a.target_kcal)
    expect(b.macros).toEqual(a.macros)
  })
})

describe('Test 7 — activityBonus API interdit', () => {
  it('reject burned_calories et activityBonus dans le payload brut', () => {
    const err = validateForbiddenActivityFields({ burned_calories: 500, age: 30 })
    expect(err?.code).toBe(ERROR_CODES.FORBIDDEN_ACTIVITY_FIELD)
  })
})

describe('Test 8 — Senior', () => {
  it('message UI sans altérer macros (champs reco seulement)', () => {
    const base = runNutritionEngine({ ...BASE_INPUT, age: 70 })
    const withEffort = runNutritionEngine({
      ...BASE_INPUT,
      age: 70,
      duration_h: 2,
      intensity: 'high',
      effort_weight_loss_kg: 1,
    })
    expect(base.ok && withEffort.ok).toBe(true)
    if (!base.ok || !withEffort.ok) return
    expect(base.recommendations.some((m) => m.includes('40g'))).toBe(true)
    expect(base.target_kcal).toBe(withEffort.target_kcal)
    expect(base.macros).toEqual(withEffort.macros)
  })
})

describe('Test 9 — Hydratation base', () => {
  it('80 kg → 2.8 L/jour', () => {
    const recs = buildRecommendations({ ...BASE_INPUT, weight_kg: 80 })
    expect(recs.some((m) => m.includes('2.8 L'))).toBe(true)
  })
})

describe('Test 10 — Post-effort', () => {
  it('perte 1.5 kg → 2.25 L', () => {
    const recs = buildRecommendations({ ...BASE_INPUT, effort_weight_loss_kg: 1.5 })
    expect(recs.some((m) => m.includes('2.25 Litres'))).toBe(true)
  })
})

describe('Test 11 — Intra-effort', () => {
  it('durée > 1h et intensité élevée', () => {
    const recs = buildRecommendations({
      ...BASE_INPUT,
      duration_h: 1.5,
      intensity: 'high',
    })
    expect(recs.some((m) => m.includes('0,5 à 1 L'))).toBe(true)
  })
})

describe('Test 12 — Surplus', () => {
  it('augmente Target sans changer Prot_Target g/kg', () => {
    const maintain = runNutritionEngine({ ...BASE_INPUT, weight_kg: 70, sport_principal: 'musculation' })
    const bulk = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 70,
      sport_principal: 'musculation',
      goal: 'bulk',
      surplus_kcal: 400,
    })
    expect(maintain.ok && bulk.ok).toBe(true)
    if (!maintain.ok || !bulk.ok) return
    expect(bulk.target_kcal).toBeGreaterThan(maintain.target_kcal)
    expect(bulk.constraints.prot_target_g / 70).toBeCloseTo(
      maintain.constraints.prot_target_g / 70,
      6,
    )
  })
})

describe('Test 13 — Perte + musculation', () => {
  it('Prot_Min et Prot_Target = 2.4 g/kg', () => {
    const flags = resolveSportFlags('musculation', null)
    expect(resolveProteinMinGPerKg(flags, 'cut')).toBe(2.4)
    expect(resolveProteinTargetGPerKg(flags, 'cut', true)).toBe(2.4)
  })
})

describe('Test 14 — Sédentaire', () => {
  it('Prot 0.8 et Gluc_Min 0', () => {
    const result = runNutritionEngine(BASE_INPUT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.prot_min_g).toBeCloseTo(50 * 0.8, 6)
    expect(result.constraints.prot_target_g).toBeCloseTo(50 * 0.8, 6)
    expect(result.constraints.gluc_min_g).toBe(0)
  })
})

describe('Test 15 — Endurance', () => {
  it('Prot_Min 1.2, Prot_Target 1.6, Gluc 6/8 g/kg', () => {
    const input: NutritionEngineInput = { ...BASE_INPUT, weight_kg: 70, sport_principal: 'velo' }
    const flags = resolveSportFlags('velo', null)
    expect(resolveProteinMinGPerKg(flags, 'maintain')).toBe(1.2)
    expect(resolveProteinTargetGPerKg(flags, 'maintain', true)).toBe(1.6)
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.gluc_min_g).toBeCloseTo(420, 6)
    expect(result.constraints.gluc_target_g).toBeCloseTo(560, 6)
  })
})

describe('Test 16 — Sport collectif', () => {
  it('Prot_Min 1.4 et Prot_Target 1.6', () => {
    const flags = resolveSportFlags('football', null)
    expect(resolveProteinMinGPerKg(flags, 'maintain')).toBe(1.4)
    expect(resolveProteinTargetGPerKg(flags, 'maintain', true)).toBe(1.6)
  })
})

describe('Test 17 — Target = BCMR exact', () => {
  it('macros aux minimums, Kcal_Dispo = 0', () => {
    const constraints = floorsFor(BASE_INPUT, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(BASE_INPUT, bcmr)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.kcal_dispo).toBeCloseTo(0, 6)
    expect(result.macros.proteines_g).toBeCloseTo(constraints.prot_min_g, 6)
    expect(result.macros.lipides_g).toBeCloseTo(constraints.lip_min_g, 6)
    expect(result.macros.glucides_g).toBeCloseTo(constraints.gluc_min_g, 6)
  })
})

describe('Test 18 — Target = BCMR - 1', () => {
  it('ERR_TARGET_BELOW_BCMR', () => {
    const constraints = floorsFor(BASE_INPUT, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(BASE_INPUT, bcmr - 1)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
    expect(result.httpStatus).toBe(422)
  })
})

describe('Test 19 — Aucune macro négative', () => {
  it('profils proches du BCMR', () => {
    const profiles: NutritionEngineInput[] = [
      BASE_INPUT,
      { ...BASE_INPUT, weight_kg: 130, sport_principal: 'musculation', goal: 'cut', deficit_kcal: 0 },
      { ...BASE_INPUT, sport_principal: 'velo' },
    ]
    for (const input of profiles) {
      const constraints = floorsFor(input, 9999)
      const bcmr = computeBcmrKcal(constraints)
      for (const delta of [0, 1, 20, 100]) {
        const result = runNutritionEngineWithTarget(input, bcmr + delta)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.macros.proteines_g).toBeGreaterThanOrEqual(0)
        expect(result.macros.lipides_g).toBeGreaterThanOrEqual(0)
        expect(result.macros.glucides_g).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('Test 20 — Conservation énergétique', () => {
  it('4P + 9L + 4G ≈ Target sur plusieurs profils', () => {
    const profiles: NutritionEngineInput[] = [
      { ...BASE_INPUT, weight_kg: 80, activity: 3, sport_principal: 'musculation' },
      { ...BASE_INPUT, weight_kg: 70, goal: 'bulk', surplus_kcal: 400, sport_principal: 'football' },
      { ...BASE_INPUT, sport_principal: 'velo' },
      { ...BASE_INPUT, weight_kg: 130, goal: 'cut', sport_principal: 'musculation', deficit_kcal: 100 },
    ]
    for (const input of profiles) {
      const result = runNutritionEngine(input)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(Math.abs(macroTotal(result) - result.target_kcal)).toBeLessThanOrEqual(3)
    }
  })
})

describe('Régression — EER IOM et objectifs', () => {
  it('équations IOM sans calories brûlées', () => {
    const eer = computeEer({
      sex: 'male',
      age: 30,
      weight_kg: 80,
      height_m: 1.8,
      activity: 3,
    })
    expect(eer).toBeCloseTo(662 - 285.9 + 1.25 * (1272.8 + 971.28), 2)
  })

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

describe('Régression — validation âge', () => {
  it('age < 18 → ERR_AGE_RESTRICTION', () => {
    const result = runNutritionEngine({ ...BASE_INPUT, age: 17 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.AGE_RESTRICTION)
  })
})

describe('Régression — payload API', () => {
  it('format SUCCESS conforme', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 80,
      sport_principal: 'musculation',
    })
    const payload = formatApiPayload(result)
    expect(payload.status).toBe('SUCCESS')
    if (payload.status !== 'SUCCESS') return
    expect(Number.isInteger(payload.target_kcal)).toBe(true)
    expect(Number.isInteger(payload.macros.proteines_g)).toBe(true)
    expect(payload.recommandations_ui.length).toBeGreaterThan(0)
  })

  it('format ERROR BCMR conforme', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      sex: 'female',
      weight_kg: 50,
      sport_principal: 'velo',
      goal: 'cut',
      deficit_kcal: 2000,
    })
    const payload = formatApiPayload(result)
    expect(payload.status).toBe('ERROR')
    if (payload.status !== 'ERROR') return
    expect(payload.error_code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
    expect(payload.recommandations_ui).toEqual([])
  })
})

describe('Régression — recommandations isolées', () => {
  it('n’altère pas target_kcal ni macros', () => {
    const withRec = runNutritionEngine({
      ...BASE_INPUT,
      duration_h: 2,
      intensity: 'high',
      effort_weight_loss_kg: 1.2,
    })
    const withoutRec = runNutritionEngine({
      ...BASE_INPUT,
      duration_h: 0,
      intensity: null,
      effort_weight_loss_kg: 0,
    })
    expect(withRec.ok && withoutRec.ok).toBe(true)
    if (!withRec.ok || !withoutRec.ok) return
    expect(withRec.target_kcal).toBe(withoutRec.target_kcal)
    expect(withRec.macros).toEqual(withoutRec.macros)
  })
})
