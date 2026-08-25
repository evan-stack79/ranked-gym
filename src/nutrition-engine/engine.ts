import { ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom.ts'
import { computeBcmrKcal, macrosToKcal } from './bcmr.ts'
import { computeEer, computeTargetKcal } from './eer.ts'
import { ERROR_CODES, engineError } from './errors.ts'
import { buildRecommendations } from './recommendations.ts'
import { applyCarbReviewRedistribution } from './redistribute.ts'
import { resolveMacroConstraints, resolveSportFlags } from './sportConstraints.ts'
import type {
  MacroFloorsAndTargets,
  MacroGrams,
  NutritionEngineInput,
  NutritionEngineResult,
  NutritionEngineSuccess,
} from './types.ts'
import { validateInput } from './validation.ts'
import { allocateWaterfall, assertAllocationInvariants } from './waterfall.ts'

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
  return {
    sportFlags,
    constraints: resolveMacroConstraints(
      input.weight_kg,
      sportFlags,
      input.goal,
      targetKcal,
      input.sport_principal,
      input.sport_secondaire,
    ),
  }
}

/**
 * Waterfall V1 puis post-pass V2 (A+) — même logique client et Edge Function.
 */
function allocateV1ThenV2(
  input: NutritionEngineInput,
  targetKcal: number,
  constraints: MacroFloorsAndTargets,
  sportFlags: ReturnType<typeof resolveSportFlags>,
): NutritionEngineResult | { macros: MacroGrams; kcal_dispo: number; allocation_flags: string[] } {
  const { macros: v1Macros, kcal_dispo } = allocateWaterfall(targetKcal, constraints)

  const allocationError = assertAllocationInvariants(targetKcal, constraints, v1Macros)
  if (allocationError) return allocationError

  const { macros, flags } = applyCarbReviewRedistribution(
    targetKcal,
    input.weight_kg,
    sportFlags,
    constraints,
    v1Macros,
  )

  const postError = assertAllocationInvariants(targetKcal, constraints, macros)
  if (postError) return postError

  const conservationError = assertEnergyConservation(targetKcal, macros)
  if (conservationError) return conservationError

  return { macros, kcal_dispo, allocation_flags: flags }
}

function buildSuccess(
  input: NutritionEngineInput,
  eer: number,
  targetKcal: number,
  bcmrKcal: number,
  kcal_dispo: number,
  macros: MacroGrams,
  constraints: MacroFloorsAndTargets,
  allocation_flags: string[],
): NutritionEngineSuccess {
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
    allocation_flags,
  }
}

/**
 * Moteur nutritionnel déterministe — point d’entrée unique.
 * N’accepte aucune variable burned_calories / activité montre.
 * V2 : Waterfall V1 + post-pass redistribution politique produit (hors endurance).
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

  const { sportFlags, constraints } = resolveConstraints(input, targetKcal)
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

  const allocated = allocateV1ThenV2(input, targetKcal, constraints, sportFlags)
  if ('ok' in allocated && allocated.ok === false) return allocated

  const { macros, kcal_dispo, allocation_flags } = allocated as {
    macros: MacroGrams
    kcal_dispo: number
    allocation_flags: string[]
  }

  return buildSuccess(
    input,
    eer,
    targetKcal,
    bcmrKcal,
    kcal_dispo,
    macros,
    constraints,
    allocation_flags,
  )
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
    allocation_flags: result.allocation_flags,
  }
}

/**
 * Réconciliation déterministe post-arrondi API (sérialisation uniquement).
 * N’ajuste qu’une macro, glucides en priorité ; ne modifie jamais Target_Kcal.
 */
export function reconcileApiIntegerMacros(
  targetKcal: number,
  proteinesG: number,
  lipidesG: number,
  glucidesG: number,
): { proteines_g: number; lipides_g: number; glucides_g: number } {
  let proteines_g = proteinesG
  let lipides_g = lipidesG
  let glucides_g = glucidesG

  const caloriesOf = (p: number, l: number, g: number) => p * 4 + l * 9 + g * 4

  const applyDelta = (): number => targetKcal - caloriesOf(proteines_g, lipides_g, glucides_g)

  let delta = applyDelta()
  if (delta === 0) {
    return { proteines_g, lipides_g, glucides_g }
  }

  // Conservation exacte via glucides (4 kcal/g)
  if (delta % 4 === 0) {
    const dg = delta / 4
    if (glucides_g + dg >= 0) {
      glucides_g += dg
      return { proteines_g, lipides_g, glucides_g }
    }
  }

  // Conservation exacte via lipides (9 kcal/g) — si glucides impossibles / non divisibles par 4
  if (delta % 9 === 0) {
    const dl = delta / 9
    if (lipides_g + dl >= 0) {
      lipides_g += dl
      return { proteines_g, lipides_g, glucides_g }
    }
  }

  // Conservation exacte via protéines (4 kcal/g) si glucides bloqués à 0
  if (delta % 4 === 0) {
    const dp = delta / 4
    if (proteines_g + dp >= 0) {
      proteines_g += dp
      return { proteines_g, lipides_g, glucides_g }
    }
  }

  // Approximation : une seule macro, résidu minimal ; priorité G → P → L ; jamais < 0
  type MacroKey = 'g' | 'p' | 'l'
  type Candidate = { macro: MacroKey; adj: number; residualAbs: number }
  const candidates: Candidate[] = []
  const pushNear = (macro: MacroKey, current: number, stepKcal: number) => {
    const ideal = delta / stepKcal
    for (const adj of [Math.floor(ideal), Math.ceil(ideal)]) {
      if (current + adj < 0) continue
      candidates.push({ macro, adj, residualAbs: Math.abs(delta - stepKcal * adj) })
    }
  }
  pushNear('g', glucides_g, 4)
  pushNear('p', proteines_g, 4)
  pushNear('l', lipides_g, 9)

  const rank: Record<MacroKey, number> = { g: 0, p: 1, l: 2 }
  candidates.sort((a, b) => {
    if (a.residualAbs !== b.residualAbs) return a.residualAbs - b.residualAbs
    if (rank[a.macro] !== rank[b.macro]) return rank[a.macro] - rank[b.macro]
    return Math.abs(a.adj) - Math.abs(b.adj)
  })

  const best = candidates[0]
  if (best && best.adj !== 0) {
    if (best.macro === 'g') glucides_g += best.adj
    else if (best.macro === 'p') proteines_g += best.adj
    else lipides_g += best.adj
  }

  return { proteines_g, lipides_g, glucides_g }
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
      allocation_flags: [] as string[],
    }
  }

  const target_kcal = roundKcal(result.target_kcal)
  const rounded = {
    proteines_g: roundMacro(result.macros.proteines_g),
    lipides_g: roundMacro(result.macros.lipides_g),
    glucides_g: roundMacro(result.macros.glucides_g),
  }
  const macros = reconcileApiIntegerMacros(
    target_kcal,
    rounded.proteines_g,
    rounded.lipides_g,
    rounded.glucides_g,
  )

  return {
    status: 'SUCCESS' as const,
    target_kcal,
    bcmr_kcal: roundKcal(result.bcmr_kcal),
    macros,
    recommandations_ui: result.recommendations,
    allocation_flags: result.allocation_flags,
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

  const { sportFlags, constraints } = resolveConstraints(input, targetKcalOverride)
  const bcmrKcal = computeBcmrKcal(constraints)

  if (targetKcalOverride < bcmrKcal) {
    return engineError(
      ERROR_CODES.TARGET_BELOW_BCMR,
      bcmrErrorMessage(targetKcalOverride, bcmrKcal),
      422,
      { target_kcal: targetKcalOverride, bcmr_kcal: bcmrKcal },
    )
  }

  const allocated = allocateV1ThenV2(input, targetKcalOverride, constraints, sportFlags)
  if ('ok' in allocated && allocated.ok === false) return allocated

  const { macros, kcal_dispo, allocation_flags } = allocated as {
    macros: MacroGrams
    kcal_dispo: number
    allocation_flags: string[]
  }

  const eer = computeEer({
    sex: input.sex,
    age: input.age,
    weight_kg: input.weight_kg,
    height_m: input.height_m,
    activity: input.activity,
  })

  return buildSuccess(
    input,
    eer,
    targetKcalOverride,
    bcmrKcal,
    kcal_dispo,
    macros,
    constraints,
    allocation_flags,
  )
}
