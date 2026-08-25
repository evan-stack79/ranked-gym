import { ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom'
import { computeBcmrKcal, macrosToKcal } from './bcmr'
import { computeEer, computeTargetKcal } from './eer'
import { ERROR_CODES, engineError } from './errors'
import { buildRecommendations } from './recommendations'
import { resolveMacroConstraints, resolveSportFlags } from './sportConstraints'
import type { MacroGrams, NutritionEngineInput, NutritionEngineResult } from './types'
import { validateInput } from './validation'
import { allocateWaterfall, assertAllocationInvariants } from './waterfall'

function bcmrErrorMessage(targetKcal: number, bcmrKcal: number): string {
  return (
    `Le déficit demandé est incompatible avec les minimums nutritionnels requis. ` +
    `Cible calorique : ${Math.round(targetKcal)} kcal. BCMR : ${Math.round(bcmrKcal)} kcal. ` +
    `Réduisez le déficit calorique.`
  )
}

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

function resolveConstraints(input: NutritionEngineInput, targetKcal: number) {
  const sportFlags = resolveSportFlags(input.sport_principal, input.sport_secondaire)
  return resolveMacroConstraints(
    input.weight_kg,
    sportFlags,
    input.goal,
    targetKcal,
    input.sport_principal,
    input.sport_secondaire,
  )
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

  const constraints = resolveConstraints(input, targetKcal)
  const bcmrKcal = computeBcmrKcal(constraints)

  if (targetKcal < bcmrKcal) {
    return engineError(
      ERROR_CODES.TARGET_BELOW_BCMR,
      bcmrErrorMessage(targetKcal, bcmrKcal),
      422,
      {
        target_kcal: targetKcal,
        bcmr_kcal: bcmrKcal,
        constraints,
      },
    )
  }

  const { macros, kcal_dispo } = allocateWaterfall(targetKcal, constraints)

  const allocationError = assertAllocationInvariants(targetKcal, constraints, macros)
  if (allocationError) return allocationError

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

/** Sérialisation interne UI — arrondis d’affichage. */
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

/** Payload API production — arrondis entiers pour kcal et macros. */
export function formatApiPayload(result: NutritionEngineResult) {
  const roundKcal = (n: number) => Math.round(n)
  const roundMacro = (n: number) => Math.round(n)

  if (!result.ok) {
    const target = Number(result.details?.target_kcal ?? 0)
    const bcmr = Number(result.details?.bcmr_kcal ?? 0)
    return {
      status: 'ERROR' as const,
      error_code: result.code,
      target_kcal: roundKcal(target),
      bcmr_kcal: roundKcal(bcmr),
      recommandations_ui: [] as string[],
    }
  }

  return {
    status: 'SUCCESS' as const,
    target_kcal: roundKcal(result.target_kcal),
    bcmr_kcal: roundKcal(result.bcmr_kcal),
    macros: {
      proteines_g: roundMacro(result.macros.proteines_g),
      lipides_g: roundMacro(result.macros.lipides_g),
      glucides_g: roundMacro(result.macros.glucides_g),
    },
    recommandations_ui: result.recommendations,
  }
}

export function runNutritionEngineApi(input: NutritionEngineInput) {
  const result = runNutritionEngine(input)
  const payload = formatApiPayload(result)
  const status = result.ok ? 200 : result.httpStatus
  return { status, body: payload }
}

/** Utilitaire tests — force une cible calorique sans recalculer EER. */
export function runNutritionEngineWithTarget(
  input: NutritionEngineInput,
  targetKcalOverride: number,
): NutritionEngineResult {
  const validationError = validateInput(input)
  if (validationError) return validationError

  const constraints = resolveConstraints(input, targetKcalOverride)
  const bcmrKcal = computeBcmrKcal(constraints)

  if (targetKcalOverride < bcmrKcal) {
    return engineError(
      ERROR_CODES.TARGET_BELOW_BCMR,
      bcmrErrorMessage(targetKcalOverride, bcmrKcal),
      422,
      { target_kcal: targetKcalOverride, bcmr_kcal: bcmrKcal },
    )
  }

  const { macros, kcal_dispo } = allocateWaterfall(targetKcalOverride, constraints)

  const allocationError = assertAllocationInvariants(targetKcalOverride, constraints, macros)
  if (allocationError) return allocationError

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
