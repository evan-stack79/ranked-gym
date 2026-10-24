import { diaryRollup, type DiaryMealInput, type NutritionDayCache } from './diaryRollup.ts'

export interface HomeNutritionRead {
  source: 'snapshot' | 'today'
  logged: boolean
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  waterMl: number | null
  targetKcal: number | null
  proteinTargetG: number | null
  /** Anneau d’eau seulement si l’utilisateur a fixé un objectif. */
  showWaterRing: boolean
}

/**
 * Accueil : le snapshot du jour gagne. Sinon, rollup des repas d’aujourd’hui
 * seulement — jamais un rescan de l’historique.
 * kcal null reste null (un jour vide n’est pas 0).
 */
export function readHomeNutritionDay(input: {
  snapshot: NutritionDayCache | null
  todayMeals: DiaryMealInput[]
  todayWaterMl: number | null
  waterGoalMl: number | null
}): HomeNutritionRead {
  const goal = input.waterGoalMl
  const showWaterRing = goal != null && Number.isFinite(goal) && goal > 0
  if (input.snapshot) {
    return {
      source: 'snapshot',
      logged: input.snapshot.logged,
      kcal: input.snapshot.kcal,
      proteinG: input.snapshot.proteinG,
      carbsG: input.snapshot.carbsG,
      fatG: input.snapshot.fatG,
      fiberG: input.snapshot.fiberG,
      waterMl: input.snapshot.waterMl,
      targetKcal: input.snapshot.targetKcal,
      proteinTargetG: input.snapshot.proteinTargetG,
      showWaterRing: showWaterRing && input.snapshot.waterMl != null,
    }
  }
  const rollup = diaryRollup({
    meals: input.todayMeals,
    waterMl: input.todayWaterMl,
  })
  return {
    source: 'today',
    logged: rollup.logged,
    kcal: rollup.kcal,
    proteinG: rollup.proteinG,
    carbsG: rollup.carbsG,
    fatG: rollup.fatG,
    fiberG: rollup.fiberG,
    waterMl: rollup.waterMl,
    targetKcal: null,
    proteinTargetG: null,
    showWaterRing: showWaterRing && rollup.waterMl != null,
  }
}
