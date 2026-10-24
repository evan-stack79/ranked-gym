import type { DiaryRollup } from './diaryRollup.ts'

export const MEALS_COMPLETE_XP = 25
export const PROTEIN_GOAL_XP = 10
export const NUTRITION_XP_DAY_CAP = 35

export type NutritionAwardKind = 'meals_complete' | 'protein_goal'

export interface NutritionXpEvaluation {
  mealsComplete: boolean
  proteinGoal: boolean
  mealsCompleteXp: number
  proteinGoalXp: number
  totalXp: number
}

/**
 * meals_complete : petit-déjeuner, déjeuner et dîner chacun comptés (le snack ne compte pas).
 * protein_goal : proteinG fini ≥ cible (97,6 g, pas l’entier API 98). Cible null → impossible.
 * Eau, fibres, écart calorique : 0 XP. Plafond 35.
 * Porte fermée (mineur, TCA) → 0, même si le journal est complet.
 */
export function evaluateNutritionXp(input: {
  rollup: DiaryRollup
  proteinTargetG: number | null
  foodAddOpen: boolean
}): NutritionXpEvaluation {
  if (!input.foodAddOpen) {
    return {
      mealsComplete: false,
      proteinGoal: false,
      mealsCompleteXp: 0,
      proteinGoalXp: 0,
      totalXp: 0,
    }
  }
  const mealsComplete = input.rollup.hasBreakfast && input.rollup.hasLunch && input.rollup.hasDinner
  const protein = input.rollup.proteinG
  const target = input.proteinTargetG
  const proteinGoal =
    target != null &&
    Number.isFinite(target) &&
    protein != null &&
    Number.isFinite(protein) &&
    protein >= target
  const mealsCompleteXp = mealsComplete ? MEALS_COMPLETE_XP : 0
  const proteinGoalXp = proteinGoal ? PROTEIN_GOAL_XP : 0
  const totalXp = Math.min(NUTRITION_XP_DAY_CAP, mealsCompleteXp + proteinGoalXp)
  return { mealsComplete, proteinGoal, mealsCompleteXp, proteinGoalXp, totalXp }
}

export function xpForKind(evaluation: NutritionXpEvaluation, kind: NutritionAwardKind): number {
  if (kind === 'meals_complete') return evaluation.mealsCompleteXp
  return evaluation.proteinGoalXp
}
