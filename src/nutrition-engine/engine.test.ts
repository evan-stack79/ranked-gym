import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  ALLOCATION_FLAGS,
  API_INTEGER_ENERGY_TOLERANCE_KCAL,
  allocateWaterfall,
  buildRecommendations,
  computeBcmrKcal,
  computeEer,
  formatApiPayload,
  macrosToKcal,
  reconcileApiIntegerMacros,
  resolveMacroConstraints,
  resolveProteinMinGPerKg,
  resolveProteinTargetGPerKg,
  resolveSportFlags,
  runNutritionEngine,
  runNutritionEngineWithTarget,
  serializeEngineResult,
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

describe('Nutrition Engine V2 — post-pass carb review (politique produit)', () => {
  const screenBulk: NutritionEngineInput = {
    sex: 'male',
    age: 18,
    weight_kg: 61.7,
    height_m: 1.7,
    activity: 4,
    goal: 'bulk',
    deficit_kcal: 0,
    surplus_kcal: 550,
    sport_principal: 'musculation',
    sport_secondaire: null,
    duration_h: 0,
    intensity: null,
    effort_weight_loss_kg: 0,
    effort_fluid_loss_l: 0,
  }

  it('61,7 kg / ~3851 kcal — redistrib Lip→Prot, FLAG remaining, conservation', () => {
    const result = runNutritionEngine(screenBulk)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.round(result.target_kcal)).toBe(3851)
    expect(Math.round(result.bcmr_kcal)).toBe(623)
    expect(result.constraints.prot_min_g / 61.7).toBeCloseTo(1.4, 6)
    expect(result.constraints.prot_target_g / 61.7).toBeCloseTo(1.6, 6)
    expect(result.macros.proteines_g / 61.7).toBeCloseTo(2.2, 5)
    expect((result.macros.lipides_g * 9) / result.target_kcal).toBeCloseTo(0.35, 5)
    expect(result.macros.glucides_g / 61.7).toBeGreaterThan(7)
    expect(result.allocation_flags).toContain(ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS)
    expect(Math.abs(macroTotal(result) - result.target_kcal)).toBeLessThanOrEqual(3)
    expect(result.macros.proteines_g).toBeGreaterThanOrEqual(0)
    expect(result.macros.lipides_g).toBeGreaterThanOrEqual(0)
    expect(result.macros.glucides_g).toBeGreaterThanOrEqual(0)
  })

  it('maintien musculation — redistrib jusqu’au seuil produit ou FLAG', () => {
    const result = runNutritionEngine({ ...screenBulk, goal: 'maintain', surplus_kcal: 0 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const gPerKg = result.macros.glucides_g / 61.7
    expect(result.allocation_flags.length).toBeGreaterThan(0)
    expect(
      result.allocation_flags.includes(ALLOCATION_FLAGS.CARB_REDISTRIBUTED_WITHIN_LIMITS) ||
        result.allocation_flags.includes(ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS),
    ).toBe(true)
    if (result.allocation_flags.includes(ALLOCATION_FLAGS.CARB_REDISTRIBUTED_WITHIN_LIMITS)) {
      expect(gPerKg).toBeLessThanOrEqual(7 + 1e-6)
    }
    expect((result.macros.lipides_g * 9) / result.target_kcal).toBeLessThanOrEqual(0.35 + 1e-6)
    expect(result.macros.proteines_g / 61.7).toBeLessThanOrEqual(2.2 + 1e-6)
  })

  it('surplus modéré musculation — conservation', () => {
    const result = runNutritionEngine({ ...screenBulk, surplus_kcal: 250 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Math.abs(macroTotal(result) - result.target_kcal)).toBeLessThanOrEqual(3)
  })

  it('endurance — pas de redistrib (priorité glucides V1)', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 70,
      sport_principal: 'velo',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.allocation_flags).toEqual([])
    expect(result.constraints.gluc_min_g).toBeCloseTo(70 * 6, 6)
  })

  it('force + endurance — hasEndurance → pas de redistrib', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 70,
      sport_principal: 'musculation',
      sport_secondaire: 'course-a-pied',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.allocation_flags).toEqual([])
    expect(result.macros.proteines_g / 70).toBeCloseTo(1.6, 5)
  })

  it('cut + musculation — Prot_Target 2.4 non downgradé', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 80,
      activity: 3,
      goal: 'cut',
      deficit_kcal: 300,
      sport_principal: 'musculation',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.constraints.prot_min_g / 80).toBeCloseTo(2.4, 6)
    expect(result.macros.proteines_g / 80).toBeGreaterThanOrEqual(2.4 - 1e-6)
  })

  it('Target = BCMR — macros aux minimums, pas d’erreur', () => {
    const constraints = floorsFor({ ...screenBulk, goal: 'maintain', surplus_kcal: 0 }, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(
      { ...screenBulk, goal: 'maintain', surplus_kcal: 0 },
      bcmr,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.kcal_dispo).toBeCloseTo(0, 6)
    expect(result.macros.proteines_g).toBeCloseTo(constraints.prot_min_g, 6)
    expect(result.allocation_flags).toEqual([])
  })

  it('Target = BCMR - 1 → ERR_TARGET_BELOW_BCMR', () => {
    const constraints = floorsFor({ ...screenBulk, goal: 'maintain', surplus_kcal: 0 }, 9999)
    const bcmr = computeBcmrKcal(constraints)
    const result = runNutritionEngineWithTarget(
      { ...screenBulk, goal: 'maintain', surplus_kcal: 0 },
      bcmr - 1,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(ERROR_CODES.TARGET_BELOW_BCMR)
  })

  it('gros surplus — Lip/Prot saturés + FLAG remaining', () => {
    const result = runNutritionEngine({ ...screenBulk, surplus_kcal: 1000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.macros.proteines_g / 61.7).toBeCloseTo(2.2, 5)
    expect((result.macros.lipides_g * 9) / result.target_kcal).toBeCloseTo(0.35, 5)
    expect(result.allocation_flags).toContain(ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS)
  })

  it('sédentaire — sous seuil → pas de FLAG', () => {
    const result = runNutritionEngine({
      ...BASE_INPUT,
      weight_kg: 75,
      activity: 1,
      sport_principal: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.allocation_flags).toEqual([])
    expect(result.macros.proteines_g / 75).toBeCloseTo(0.8, 5)
  })

  it('déterminisme — deux appels identiques', () => {
    const a = runNutritionEngine(screenBulk)
    const b = runNutritionEngine(screenBulk)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.macros).toEqual(b.macros)
    expect(a.allocation_flags).toEqual(b.allocation_flags)
    expect(a.target_kcal).toBe(b.target_kcal)
  })

  it('steps/workout/activityBonus absents du contrat — résultat inchangé', () => {
    const clean = runNutritionEngine(screenBulk)
    const polluted = runNutritionEngine({
      ...screenBulk,
      ...( {
        steps: 12000,
        workout_calories: 600,
        activityBonus: 400,
        burned_calories: 900,
      } as unknown as NutritionEngineInput),
    })
    expect(clean.ok && polluted.ok).toBe(true)
    if (!clean.ok || !polluted.ok) return
    expect(polluted.target_kcal).toBe(clean.target_kcal)
    expect(polluted.macros).toEqual(clean.macros)
  })
})

describe('Réconciliation arrondi API (sérialisation)', () => {
  const apiCalories = (p: number, l: number, g: number) => p * 4 + l * 9 + g * 4

  const screenBulk: NutritionEngineInput = {
    sex: 'male',
    age: 18,
    weight_kg: 61.7,
    height_m: 1.7,
    activity: 4,
    goal: 'bulk',
    deficit_kcal: 0,
    surplus_kcal: 550,
    sport_principal: 'musculation',
    sport_secondaire: null,
    duration_h: 0,
    intensity: null,
    effort_weight_loss_kg: 0,
    effort_fluid_loss_l: 0,
  }

  it('A — 61,7 kg / Target 3851 : conservation API dans la tolérance documentée', () => {
    const result = runNutritionEngine(screenBulk)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const rawP = Math.round(result.macros.proteines_g)
    const rawL = Math.round(result.macros.lipides_g)
    const rawG = Math.round(result.macros.glucides_g)
    expect(rawP).toBe(136)
    expect(rawL).toBe(150)
    expect(rawG).toBe(490)
    expect(apiCalories(rawP, rawL, rawG)).toBe(3854)

    const payload = formatApiPayload(result)
    expect(payload.status).toBe('SUCCESS')
    if (payload.status !== 'SUCCESS') return
    expect(payload.target_kcal).toBe(3851)
    const cal = apiCalories(
      payload.macros.proteines_g,
      payload.macros.lipides_g,
      payload.macros.glucides_g,
    )
    // delta post-arrondi = -3 : non multiple de 4 ni 9 → exact impossible ; G-1 → 3850
    expect(Math.abs(cal - payload.target_kcal)).toBeLessThanOrEqual(API_INTEGER_ENERGY_TOLERANCE_KCAL)
    expect(cal).toBe(3850)
    expect(payload.macros.glucides_g).toBe(489)
    expect(payload.macros.proteines_g).toBe(136)
    expect(payload.macros.lipides_g).toBe(150)
  })

  it('B — conservation exacte possible (delta multiple de 4 → glucides)', () => {
    // 100*4+50*9+200*4 = 1650 ; target 1654 → delta +4 → G+1
    const exact = reconcileApiIntegerMacros(1654, 100, 50, 200)
    expect(exact).toEqual({ proteines_g: 100, lipides_g: 50, glucides_g: 201 })
    expect(apiCalories(exact.proteines_g, exact.lipides_g, exact.glucides_g)).toBe(1654)
  })

  it('B2 — conservation exacte via lipides (delta multiple de 9, pas de 4)', () => {
    // 100*4+50*9+200*4 = 1650 ; target 1659 → delta 9 → L+1
    const exact = reconcileApiIntegerMacros(1659, 100, 50, 200)
    expect(exact).toEqual({ proteines_g: 100, lipides_g: 51, glucides_g: 200 })
    expect(apiCalories(exact.proteines_g, exact.lipides_g, exact.glucides_g)).toBe(1659)
  })

  it('C — conservation exacte impossible : tolérance documentée respectée', () => {
    // 136*4+150*9+490*4 = 3854 ; target 3851 ; delta -3
    const macros = reconcileApiIntegerMacros(3851, 136, 150, 490)
    const cal = apiCalories(macros.proteines_g, macros.lipides_g, macros.glucides_g)
    expect(cal).not.toBe(3851)
    expect(Math.abs(cal - 3851)).toBeLessThanOrEqual(API_INTEGER_ENERGY_TOLERANCE_KCAL)
    expect(API_INTEGER_ENERGY_TOLERANCE_KCAL).toBe(2)
    expect(macros.glucides_g).toBe(489)
  })

  it('D — macros API jamais négatives', () => {
    // Besoin de retirer 40 kcal (10 g) alors que G=2 → bascule protéines
    const macros = reconcileApiIntegerMacros(100, 20, 4, 2)
    // 20*4+4*9+2*4 = 80+36+8 = 124 ; delta = -24 → G-6 impossible ; G→0 (−8 kcal) insuffisant
    // exact via P: -24 % 4 === 0 → try G first fails, L: -24%9 !== 0, P: -24/4=-6 → P=14
    expect(macros.proteines_g).toBeGreaterThanOrEqual(0)
    expect(macros.lipides_g).toBeGreaterThanOrEqual(0)
    expect(macros.glucides_g).toBeGreaterThanOrEqual(0)
    expect(apiCalories(macros.proteines_g, macros.lipides_g, macros.glucides_g)).toBe(100)

    const clamped = reconcileApiIntegerMacros(50, 1, 0, 0)
    // 4 kcal only ; target 50 → need +46 ; not exact with one macro from (1,0,0)
    // G+11 = 44 residual 2; G+12 = 48 residual -2; P same
    expect(clamped.proteines_g).toBeGreaterThanOrEqual(0)
    expect(clamped.lipides_g).toBeGreaterThanOrEqual(0)
    expect(clamped.glucides_g).toBeGreaterThanOrEqual(0)
  })

  it('E — floats internes inchangés après formatApiPayload', () => {
    const result = runNutritionEngine(screenBulk)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const before = structuredClone(result.macros)
    formatApiPayload(result)
    expect(result.macros).toEqual(before)
  })

  it('F — allocation_flags identiques dans le payload API', () => {
    const result = runNutritionEngine(screenBulk)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const payload = formatApiPayload(result)
    expect(payload.status).toBe('SUCCESS')
    if (payload.status !== 'SUCCESS') return
    expect(payload.allocation_flags).toEqual(result.allocation_flags)
  })

  it('G — sérialisation UI 1 décimale inchangée par la réconciliation API', () => {
    const result = runNutritionEngine(screenBulk)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const uiBefore = serializeEngineResult(result)
    formatApiPayload(result)
    const uiAfter = serializeEngineResult(result)
    expect(uiAfter).toEqual(uiBefore)
    expect(uiBefore.proteines_g).toBe(Math.round(result.macros.proteines_g * 10) / 10)
  })
})
