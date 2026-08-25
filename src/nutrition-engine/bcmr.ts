import { KCAL_PER_G } from './constants/iom.ts'
import type { MacroFloorsAndTargets, MacroGrams } from './types.ts'

export function computeBcmrKcal(constraints: MacroFloorsAndTargets): number {
  return (
    constraints.prot_min_g * KCAL_PER_G.protein +
    constraints.lip_min_g * KCAL_PER_G.fat +
    constraints.gluc_min_g * KCAL_PER_G.carb
  )
}

export function macrosToKcal(macros: MacroGrams): {
  proteines_kcal: number
  lipides_kcal: number
  glucides_kcal: number
  total_kcal: number
} {
  const proteines_kcal = macros.proteines_g * KCAL_PER_G.protein
  const lipides_kcal = macros.lipides_g * KCAL_PER_G.fat
  const glucides_kcal = macros.glucides_g * KCAL_PER_G.carb
  return {
    proteines_kcal,
    lipides_kcal,
    glucides_kcal,
    total_kcal: proteines_kcal + lipides_kcal + glucides_kcal,
  }
}
