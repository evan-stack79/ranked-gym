import { IOM_EER, IOM_PA } from './constants/iom.ts'
import type { ActivityLevel, Sex } from './types.ts'

export interface EerInput {
  sex: Sex
  age: number
  weight_kg: number
  height_m: number
  activity: ActivityLevel
}

/**
 * Dépense énergétique estimée (EER) — équations IOM uniquement.
 * Aucune calorie d’exercice / montre n’est ajoutée.
 */
export function computeEer(input: EerInput): number {
  const coeffs = IOM_EER[input.sex]
  const pa = IOM_PA[input.sex][input.activity - 1]
  const energyCost =
    coeffs.weightCoef * input.weight_kg + coeffs.heightCoef * input.height_m
  return coeffs.intercept - coeffs.ageCoef * input.age + pa * energyCost
}

export function computeTargetKcal(
  eer: number,
  goal: 'maintain' | 'cut' | 'bulk',
  deficit_kcal: number,
  surplus_kcal: number,
): number {
  if (goal === 'maintain') return eer
  if (goal === 'cut') return eer - deficit_kcal
  return eer + surplus_kcal
}
