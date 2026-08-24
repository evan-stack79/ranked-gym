import { KCAL_PER_G } from './constants/iom'
import type { MacroFloorsAndTargets, MacroGrams } from './types'

export interface WaterfallResult {
  macros: MacroGrams
  kcal_dispo: number
}

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

  // Étape 1 — Protéines : Prot_Min → Prot_Target
  const protRoomG = Math.max(0, constraints.prot_target_g - proteines_g)
  const protAddG = Math.min(protRoomG, kcalDispo / KCAL_PER_G.protein)
  proteines_g += protAddG
  kcalDispo -= protAddG * KCAL_PER_G.protein

  // Étape 2 — Lipides : Lip_Min → Lip_Target (25 % des kcal cible, ≥ plancher)
  const lipRoomG = Math.max(0, constraints.lip_target_g - lipides_g)
  const lipAddG = Math.min(lipRoomG, kcalDispo / KCAL_PER_G.fat)
  lipides_g += lipAddG
  kcalDispo -= lipAddG * KCAL_PER_G.fat

  // Étape 3 — Glucides : tout le reliquat
  glucides_g += kcalDispo / KCAL_PER_G.carb
  kcalDispo = 0

  return {
    macros: { proteines_g, lipides_g, glucides_g },
    kcal_dispo: targetKcal - bcmr,
  }
}
