import { KCAL_PER_G } from './constants/iom.ts'
import {
  ALLOCATION_FLAGS,
  CARB_REVIEW_THRESHOLD_G_PER_KG,
  LIP_MAX_PCT,
  PROTEIN_MAX_G_PER_KG,
  type AllocationFlag,
} from './constants/policy.ts'
import type { MacroFloorsAndTargets, MacroGrams } from './types.ts'
import type { SportFlags } from './sportConstraints.ts'

export interface CarbReviewResult {
  macros: MacroGrams
  flags: AllocationFlag[]
}

/**
 * Post-pass V2 — Architecture A+.
 *
 * [ALGORITHME]
 * 1. Si hasEndurance (endurance, cyclisme, ou force+endurance) → no-op (priorité glucides V1).
 * 2. Si glucides ≤ seuil produit → no-op.
 * 3. Sinon redistribuer l’excédent calorique glucidique :
 *    R1 → lipides jusqu’à LIP_MAX_PCT
 *    R2 → protéines jusqu’à max(Prot_Target, PROTEIN_MAX_G_PER_KG × poids)
 * 4. Si encore > seuil → FLAG CARB_REVIEW_REMAINING_AFTER_LIMITS ; ne plus toucher aux macros.
 *
 * [CHOIX PRODUIT] Le seuil 7 g/kg n’est pas une limite médicale.
 * BCMR / Waterfall V1 / EER ne sont pas modifiés ici.
 */
export function applyCarbReviewRedistribution(
  targetKcal: number,
  weightKg: number,
  sportFlags: SportFlags,
  constraints: MacroFloorsAndTargets,
  macrosIn: MacroGrams,
): CarbReviewResult {
  if (sportFlags.hasEndurance) {
    return { macros: { ...macrosIn }, flags: [] }
  }

  let proteines_g = macrosIn.proteines_g
  let lipides_g = macrosIn.lipides_g
  let glucides_g = macrosIn.glucides_g

  const threshG = CARB_REVIEW_THRESHOLD_G_PER_KG * weightKg
  if (glucides_g <= threshG) {
    return { macros: { proteines_g, lipides_g, glucides_g }, flags: [] }
  }

  let excessKcal = (glucides_g - threshG) * KCAL_PER_G.carb

  const lipMaxKcal = LIP_MAX_PCT * targetKcal
  const lipRoomKcal = Math.max(0, lipMaxKcal - lipides_g * KCAL_PER_G.fat)
  const toLip = Math.min(excessKcal, lipRoomKcal)
  lipides_g += toLip / KCAL_PER_G.fat
  glucides_g -= toLip / KCAL_PER_G.carb
  excessKcal -= toLip

  const protCapG = Math.max(constraints.prot_target_g, PROTEIN_MAX_G_PER_KG * weightKg)
  const protRoomKcal = Math.max(0, (protCapG - proteines_g) * KCAL_PER_G.protein)
  const toProt = Math.min(excessKcal, protRoomKcal)
  proteines_g += toProt / KCAL_PER_G.protein
  glucides_g -= toProt / KCAL_PER_G.carb

  const flags: AllocationFlag[] =
    glucides_g > threshG
      ? [ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS]
      : [ALLOCATION_FLAGS.CARB_REDISTRIBUTED_WITHIN_LIMITS]

  return {
    macros: { proteines_g, lipides_g, glucides_g },
    flags,
  }
}
