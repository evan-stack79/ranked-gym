import { KCAL_PER_G } from './constants/iom'
import { ERROR_CODES, engineError } from './errors'
import type { MacroFloorsAndTargets, MacroGrams, NutritionEngineFailure } from './types'

export interface WaterfallResult {
  macros: MacroGrams
  kcal_dispo: number
}

const EPS = 1e-9

/**
 * Allocation Waterfall séquentielle après validation BCMR.
 * Calculs internes en flottants non arrondis.
 */
export function allocateWaterfall(
  targetKcal: number,
  constraints: MacroFloorsAndTargets,
): WaterfallResult {
  let proteines_g = constraints.prot_min_g
  let lipides_g = constraints.lip_min_g
  let glucides_g = constraints.gluc_min_g

  const bcmr =
    proteines_g * KCAL_PER_G.protein +
    lipides_g * KCAL_PER_G.fat +
    glucides_g * KCAL_PER_G.carb

  let kcalDispo = targetKcal - bcmr

  const protTargetKcal = constraints.prot_target_g * KCAL_PER_G.protein
  const minProtKcal = proteines_g * KCAL_PER_G.protein
  const diffProt = protTargetKcal - minProtKcal
  const addedProt = Math.min(kcalDispo, Math.max(0, diffProt))
  proteines_g += addedProt / KCAL_PER_G.protein
  kcalDispo -= addedProt

  const lipTargetKcal = targetKcal * 0.25
  const minLipKcal = lipides_g * KCAL_PER_G.fat
  const diffLip = lipTargetKcal - minLipKcal
  const addedLip = Math.min(kcalDispo, Math.max(0, diffLip))
  lipides_g += addedLip / KCAL_PER_G.fat
  kcalDispo -= addedLip

  glucides_g += kcalDispo / KCAL_PER_G.carb
  kcalDispo = 0

  return {
    macros: { proteines_g, lipides_g, glucides_g },
    kcal_dispo: targetKcal - bcmr,
  }
}

export function assertAllocationInvariants(
  targetKcal: number,
  constraints: MacroFloorsAndTargets,
  macros: MacroGrams,
): NutritionEngineFailure | null {
  if (
    macros.proteines_g + EPS < constraints.prot_min_g ||
    macros.lipides_g + EPS < constraints.lip_min_g ||
    macros.glucides_g + EPS < constraints.gluc_min_g ||
    macros.proteines_g < 0 ||
    macros.lipides_g < 0 ||
    macros.glucides_g < 0
  ) {
    return engineError(
      ERROR_CODES.INTERNAL_ALLOCATION,
      'Allocation Waterfall invalide : invariant de plancher violé.',
      500,
      { target_kcal: targetKcal, constraints, macros },
    )
  }

  return null
}
