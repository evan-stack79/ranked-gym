import type { CalorieProfile } from '../types/nutrition'
import { runNutritionEngine, serializeEngineResult } from '../nutrition-engine'
import type { NutritionEngineSuccess } from '../nutrition-engine/types'
import { GOAL_LABELS } from '../utils/calories'
import { getCalorieProfile } from './nutritionStorage'
import { isEngineReadyProfile, profileToEngineInput } from './nutritionEngineAdapter'

export interface NutritionTargetResult {
  profile: CalorieProfile
  targetCalories: number
  eerKcal: number
  bcmrKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  recommendations: string[]
  goalLabel: string
  /**
   * Toujours 0 — l’EER/PA intègre déjà l’activité habituelle.
   * Conservé pour compatibilité d’API ; ne plus utiliser pour ajuster target_kcal.
   */
  activityBonus: number
  /** Flags d’allocation V2 (politique produit) — informatifs uniquement. */
  allocationFlags: string[]
  engineOk: boolean
  errorCode?: string
  errorMessage?: string
}

const EMPTY_TARGET: Omit<NutritionTargetResult, 'profile'> = {
  targetCalories: 0,
  eerKcal: 0,
  bcmrKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  recommendations: [],
  goalLabel: GOAL_LABELS.maintain,
  activityBonus: 0,
  allocationFlags: [],
  engineOk: false,
}

function mapEngineSuccess(
  profile: CalorieProfile,
  result: NutritionEngineSuccess,
): NutritionTargetResult {
  const serialized = serializeEngineResult(result)
  return {
    profile,
    targetCalories: serialized.target_kcal,
    eerKcal: serialized.eer_kcal,
    bcmrKcal: serialized.bcmr_kcal,
    proteinG: serialized.proteines_g,
    carbsG: serialized.glucides_g,
    fatG: serialized.lipides_g,
    recommendations: serialized.recommendations,
    goalLabel: GOAL_LABELS[profile.goal],
    activityBonus: 0,
    allocationFlags: serialized.allocation_flags,
    engineOk: true,
  }
}

/**
 * Source unique UI pour target_kcal et macros — moteur IOM déterministe.
 * N’ajoute jamais steps, workout ni calories montre.
 */
export function getNutritionTarget(profileOverride?: CalorieProfile): NutritionTargetResult {
  const profile = profileOverride ?? getCalorieProfile()

  if (!isEngineReadyProfile(profile)) {
    return { profile, ...EMPTY_TARGET, goalLabel: GOAL_LABELS[profile.goal] }
  }

  const result = runNutritionEngine(profileToEngineInput(profile))
  if (!result.ok) {
    return {
      profile,
      ...EMPTY_TARGET,
      goalLabel: GOAL_LABELS[profile.goal],
      errorCode: result.code,
      errorMessage: result.message,
    }
  }

  return mapEngineSuccess(profile, result)
}

/** @deprecated Alias — préférer getNutritionTarget */
export const getAdjustedNutritionTarget = getNutritionTarget
