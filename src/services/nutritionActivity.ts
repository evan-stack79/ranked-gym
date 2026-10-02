import type { CalorieProfile } from '../types/nutrition'
import { runNutritionEngine, serializeEngineResult } from '../nutrition-engine'
import type { NutritionEngineSuccess } from '../nutrition-engine/types'
import { GOAL_LABELS } from '../utils/calories'
import { getCalorieProfile } from './nutritionStorage'
import {
  clampEngineTargetCalories,
  isEngineReadyProfile,
  profileToEngineInput,
} from './nutritionEngineAdapter'
import { isCalorieGoalEnabled } from '../backend/calorieGoalFeatureFlag'
import {
  decideEstimationEligibility,
  decideLossEligibility,
  readHealthDeclarations,
  softBandMessage,
} from './nutritionSafetyRules'
import { M_INFO_1 } from '../content/safetyCopy'

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
  /** Mentions sécurité à afficher avec toute estimation / cible. */
  safetyNotices: string[]
  softBandWarning: boolean
  showCalorieGoal: boolean
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
  safetyNotices: [M_INFO_1],
  softBandWarning: false,
  showCalorieGoal: false,
}

function mapEngineSuccess(
  profile: CalorieProfile,
  result: NutritionEngineSuccess,
  notices: string[],
): NutritionTargetResult {
  const serialized = serializeEngineResult(result)
  const clamped = clampEngineTargetCalories(
    profile,
    serialized.target_kcal,
    serialized.eer_kcal,
  )
  const soft = softBandMessage(clamped.targetCalories)
  return {
    profile,
    targetCalories: clamped.targetCalories,
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
    safetyNotices: soft ? [...notices, soft] : notices,
    softBandWarning: clamped.softBandWarning,
    showCalorieGoal: true,
  }
}

/**
 * Source unique UI pour target_kcal et macros — moteur IOM déterministe.
 * N’ajoute jamais steps, workout ni calories montre.
 * Drapeau OFF : aucune cible / macros dérivées (objectifs stockés ignorés à l’affichage).
 */
export function getNutritionTarget(
  profileOverride?: CalorieProfile,
  opts?: { calorieGoalEnabled?: boolean },
): NutritionTargetResult {
  const profile = profileOverride ?? getCalorieProfile()
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  const declarations = readHealthDeclarations(profile)

  if (!enabled) {
    return {
      profile,
      ...EMPTY_TARGET,
      goalLabel: GOAL_LABELS.maintain,
      safetyNotices: [M_INFO_1],
      showCalorieGoal: false,
    }
  }

  const estimation = decideEstimationEligibility(
    {
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
      declarations,
    },
    { calorieGoalEnabled: true },
  )

  if (!estimation.allowed || !isEngineReadyProfile(profile, { calorieGoalEnabled: true })) {
    return {
      profile,
      ...EMPTY_TARGET,
      goalLabel: GOAL_LABELS[profile.goal],
      safetyNotices: estimation.disclaimer ? [estimation.disclaimer, M_INFO_1] : [M_INFO_1],
      errorCode: estimation.reason,
      showCalorieGoal: false,
    }
  }

  const loss = decideLossEligibility(
    {
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
      goalWeightKg: profile.goalWeightKg,
      declarations,
    },
    { calorieGoalEnabled: true },
  )

  const engineProfile =
    profile.goal === 'cut' && !loss.eligible
      ? { ...profile, goal: 'maintain' as const, weeklyPaceKg: 0 }
      : profile

  const notices = [estimation.disclaimer, M_INFO_1].filter(Boolean) as string[]

  const result = runNutritionEngine(
    profileToEngineInput(engineProfile, { calorieGoalEnabled: true }),
  )
  if (!result.ok) {
    return {
      profile,
      ...EMPTY_TARGET,
      goalLabel: GOAL_LABELS[engineProfile.goal],
      errorCode: result.code,
      errorMessage: result.message,
      safetyNotices: notices,
      showCalorieGoal: false,
    }
  }

  return mapEngineSuccess(engineProfile, result, notices)
}

/** @deprecated Alias — préférer getNutritionTarget */
export const getAdjustedNutritionTarget = getNutritionTarget
