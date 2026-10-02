import type { ActivityLevel as ProfileActivity, CalorieProfile } from '../types/nutrition'
import type { ActivityLevel as EngineActivity, NutritionEngineInput } from '../nutrition-engine/types'
import { getTrainingState } from './trainingStorage'
import {
  decideEstimationEligibility,
  decideLossEligibility,
  evaluateCalorieTarget,
  estimateRmrKcal,
  isProfileCompleteForNutrition,
  paceKgToDailyDeficit,
  readHealthDeclarations,
} from './nutritionSafetyRules'
import { isCalorieGoalEnabled } from '../backend/calorieGoalFeatureFlag'

const PROFILE_ACTIVITY_TO_IOM: Record<ProfileActivity, EngineActivity> = {
  sedentary: 1,
  light: 2,
  moderate: 3,
  active: 4,
  athlete: 4,
}

function paceToDeficitSurplus(
  profile: CalorieProfile,
  opts?: { calorieGoalEnabled?: boolean },
): { deficit_kcal: number; surplus_kcal: number } {
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  const declarations = readHealthDeclarations(profile)
  const loss = decideLossEligibility(
    {
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
      goalWeightKg: profile.goalWeightKg,
      declarations,
    },
    { calorieGoalEnabled: enabled },
  )

  const paceMag = Math.max(0, profile.weeklyPaceKg || 0)
  if (!enabled || profile.goal === 'maintain' || paceMag === 0) {
    return { deficit_kcal: 0, surplus_kcal: 0 }
  }

  if (profile.goal === 'cut') {
    if (!loss.eligible) return { deficit_kcal: 0, surplus_kcal: 0 }
    // Plafond moteur = déficit max sécurité (600), plus le plancher RMR appliqué après.
    return { deficit_kcal: Math.min(600, paceKgToDailyDeficit(paceMag)), surplus_kcal: 0 }
  }

  return { deficit_kcal: 0, surplus_kcal: Math.min(1000, paceKgToDailyDeficit(paceMag)) }
}

export function profileToEngineInput(
  profile: CalorieProfile,
  opts?: { calorieGoalEnabled?: boolean },
): NutritionEngineInput {
  const training = getTrainingState()
  const { deficit_kcal, surplus_kcal } = paceToDeficitSurplus(profile, opts)
  const sex = profile.sex === 'female' ? 'female' : 'male'

  return {
    sex,
    // Ne plus remonter les mineurs à 18 — l'âge réel est transmis ; le moteur refuse < 18.
    age: profile.age,
    weight_kg: profile.weightKg,
    height_m: profile.heightCm / 100,
    activity: PROFILE_ACTIVITY_TO_IOM[profile.activity],
    goal: profile.goal === 'cut' && deficit_kcal === 0 ? 'maintain' : profile.goal,
    deficit_kcal,
    surplus_kcal,
    sport_principal: training.primarySportId,
    sport_secondaire: null,
    duration_h: 0,
    intensity: null,
    effort_weight_loss_kg: 0,
    effort_fluid_loss_l: 0,
  }
}

export function isEngineReadyProfile(
  profile: CalorieProfile,
  opts?: { calorieGoalEnabled?: boolean },
): boolean {
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  if (!profile.onboardingComplete) return false
  if (
    !isProfileCompleteForNutrition({
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
    })
  ) {
    return false
  }

  const estimation = decideEstimationEligibility(
    {
      age: profile.age,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      sex: profile.sex,
      declarations: readHealthDeclarations(profile),
    },
    { calorieGoalEnabled: enabled },
  )

  // Sans drapeau : pas de cible moteur affichée. Avec drapeau : estimation si autorisée.
  if (!enabled) return false
  return estimation.allowed
}

/** Applique plancher / déficit après un résultat moteur. */
export function clampEngineTargetCalories(
  profile: CalorieProfile,
  targetCalories: number,
  maintenanceKcal: number,
): { targetCalories: number; softBandWarning: boolean } {
  if (profile.sex !== 'male' && profile.sex !== 'female') {
    return { targetCalories: 0, softBandWarning: false }
  }
  const rmr = estimateRmrKcal(profile.weightKg, profile.heightCm, profile.age, profile.sex)
  const decision = evaluateCalorieTarget({
    targetCalories,
    maintenanceKcal,
    rmrKcal: rmr,
    mode: 'clamp',
  })
  if (!decision.ok) {
    return { targetCalories: decision.clampedTarget ?? 0, softBandWarning: false }
  }
  return { targetCalories: decision.targetCalories, softBandWarning: decision.softBandWarning }
}
