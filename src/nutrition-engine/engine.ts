import { ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom'
import { computeBcmrKcal, macrosToKcal } from './bcmr'
import { computeEer, computeTargetKcal } from './eer'
import { ERROR_CODES, engineError } from './errors'
import { buildRecommendations } from './recommendations'
import { resolveMacroConstraints, resolveSportFlags } from './sportConstraints'
import type { MacroGrams, NutritionEngineInput, NutritionEngineResult } from './types'
import { validateInput } from './validation'
import { allocateWaterfall } from './waterfall'

function assertEnergyConservation(targetKcal: number, macros: MacroGrams): NutritionEngineResult | null {
  const kcal = macrosToKcal(macros)
  const delta = Math.abs(kcal.total_kcal - targetKcal)
  if (delta > ENERGY_ROUND_TOLERANCE_KCAL) {
    return engineError(
      ERROR_CODES.ENERGY_CONSERVATION,
      `Conservation énergétique violée (écart ${delta.toFixed(2)} kcal)`,
      500,
      { target_kcal: targetKcal, computed_kcal: kcal.total_kcal, delta },
    )
  }
  return null
}

/**
 * Moteur nutritionnel déterministe — point d’entrée unique.
 * N’accepte aucune variable burned_calories / activité montre.
 */
export function runNutritionEngine(input: NutritionEngineInput): NutritionEngineResult {
  const validationError = validateInput(input)
  if (validationError) return validationError

  const eer = computeEer({
    sex: input.sex,
    age: input.age,
    weight_kg: input.weight_kg,
    height_m: input.height_m,
    activity: input.activity,
  })

  const targetKcal = computeTargetKcal(
    eer,
    input.goal,
    input.deficit_kcal,
    input.surplus_kcal,
  )

  const sportFlags = resolveSportFlags(input.sport_principal, input.sport_secondaire)
  const constraints = resolveMacroConstraints(
    input.weight_kg,
    sportFlags,
    input.goal,
    targetKcal,
  )

  const bcmrKcal = computeBcmrKcal(constraints)

  if (targetKcal < bcmrKcal) {
    return engineError(
      ERROR_CODES.TARGET_BELOW_BCMR,
      'La cible calorique est inférieure au BCMR (planchers métaboliques).',
      422,
      {
        target_kcal: targetKcal,
        bcmr_kcal: bcmrKcal,
        constraints,
      },
    )
  }

  const { macros, kcal_dispo } = allocateWaterfall(targetKcal, constraints)

  const conservationError = assertEnergyConservation(targetKcal, macros)
  if (conservationError) return conservationError

  const macrosKcal = macrosToKcal(macros)

  return {
    ok: true,
    eer_kcal: eer,
    target_kcal: targetKcal,
    bcmr_kcal: bcmrKcal,
    kcal_dispo,
    macros,
    macros_kcal: {
      proteines_kcal: macrosKcal.proteines_kcal,
      lipides_kcal: macrosKcal.lipides_kcal,
      glucides_kcal: macrosKcal.glucides_kcal,
    },
    constraints,
    recommendations: buildRecommendations(input),
  }
}

/** Sérialisation API — arrondis uniquement ici. */
export function serializeEngineResult(result: Extract<NutritionEngineResult, { ok: true }>) {
  const round1 = (n: number) => Math.round(n * 10) / 10
  const roundKcal = (n: number) => Math.round(n)

  return {
    eer_kcal: roundKcal(result.eer_kcal),
    target_kcal: roundKcal(result.target_kcal),
    bcmr_kcal: roundKcal(result.bcmr_kcal),
    kcal_dispo: roundKcal(result.kcal_dispo),
    proteines_g: round1(result.macros.proteines_g),
    lipides_g: round1(result.macros.lipides_g),
    glucides_g: round1(result.macros.glucides_g),
    proteines_kcal: roundKcal(result.macros_kcal.proteines_kcal),
    lipides_kcal: roundKcal(result.macros_kcal.lipides_kcal),
    glucides_kcal: roundKcal(result.macros_kcal.glucides_kcal),
    constraints: {
      prot_min_g: round1(result.constraints.prot_min_g),
      prot_target_g: round1(result.constraints.prot_target_g),
      lip_min_g: round1(result.constraints.lip_min_g),
      lip_target_g: round1(result.constraints.lip_target_g),
      gluc_min_g: round1(result.constraints.gluc_min_g),
      gluc_target_g: round1(result.constraints.gluc_target_g),
    },
    recommendations: result.recommendations,
  }
}

export function runNutritionEngineApi(input: NutritionEngineInput) {
  const result = runNutritionEngine(input)
  if (!result.ok) {
    return {
      status: result.httpStatus,
      body: {
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          details: result.details,
        },
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: serializeEngineResult(result),
    },
  }
}

/** Utilitaire tests — force une cible calorique sans recalculer EER. */
export function runNutritionEngineWithTarget(
  input: NutritionEngineInput,
  targetKcalOverride: number,
): NutritionEngineResult {
  const validationError = validateInput(input)
  if (validationError) return validationError

  const sportFlags = resolveSportFlags(input.sport_principal, input.sport_secondaire)
  const constraints = resolveMacroConstraints(
    input.weight_kg,
    sportFlags,
    input.goal,
    targetKcalOverride,
  )
  const bcmrKcal = computeBcmrKcal(constraints)

  if (targetKcalOverride < bcmrKcal) {
    return engineError(
      ERROR_CODES.TARGET_BELOW_BCMR,
      'La cible calorique est inférieure au BCMR (planchers métaboliques).',
      422,
      { target_kcal: targetKcalOverride, bcmr_kcal: bcmrKcal },
    )
  }

  const { macros, kcal_dispo } = allocateWaterfall(targetKcalOverride, constraints)
  const conservationError = assertEnergyConservation(targetKcalOverride, macros)
  if (conservationError) return conservationError

  const macrosKcal = macrosToKcal(macros)
  const eer = computeEer({
    sex: input.sex,
    age: input.age,
    weight_kg: input.weight_kg,
    height_m: input.height_m,
    activity: input.activity,
  })

  return {
    ok: true,
    eer_kcal: eer,
    target_kcal: targetKcalOverride,
    bcmr_kcal: bcmrKcal,
    kcal_dispo,
    macros,
    macros_kcal: {
      proteines_kcal: macrosKcal.proteines_kcal,
      lipides_kcal: macrosKcal.lipides_kcal,
      glucides_kcal: macrosKcal.glucides_kcal,
    },
    constraints,
    recommendations: buildRecommendations(input),
  }
}
