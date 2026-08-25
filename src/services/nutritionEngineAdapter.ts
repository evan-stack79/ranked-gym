import type { ActivityLevel as ProfileActivity, CalorieProfile } from '../types/nutrition'
import type { ActivityLevel as EngineActivity, NutritionEngineInput } from '../nutrition-engine/types'
import { getTrainingState } from './trainingStorage'

const PROFILE_ACTIVITY_TO_IOM: Record<ProfileActivity, EngineActivity> = {
  sedentary: 1,
  light: 2,
  moderate: 3,
  active: 4,
  athlete: 4,
}

/** IOM adulte ≥ 19 ans — clamp onboarding si âge < 18. */
function engineAge(profileAge: number): number {
  return Math.max(18, Math.min(120, profileAge))
}

function paceToDeficitSurplus(profile: CalorieProfile): { deficit_kcal: number; surplus_kcal: number } {
  const paceMag = Math.max(0, profile.weeklyPaceKg || 0)
  if (profile.goal === 'maintain' || paceMag === 0) {
    return { deficit_kcal: 0, surplus_kcal: 0 }
  }
  const daily = Math.round((paceMag * 7700) / 7)
  if (profile.goal === 'cut') {
    return { deficit_kcal: Math.min(2000, daily), surplus_kcal: 0 }
  }
  return { deficit_kcal: 0, surplus_kcal: Math.min(1000, daily) }
}

export function profileToEngineInput(profile: CalorieProfile): NutritionEngineInput {
  const training = getTrainingState()
  const { deficit_kcal, surplus_kcal } = paceToDeficitSurplus(profile)

  return {
    sex: profile.sex,
    age: engineAge(profile.age),
    weight_kg: profile.weightKg,
    height_m: profile.heightCm / 100,
    activity: PROFILE_ACTIVITY_TO_IOM[profile.activity],
    goal: profile.goal,
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

export function isEngineReadyProfile(profile: CalorieProfile): boolean {
  return (
    profile.onboardingComplete &&
    profile.weightKg >= 30 &&
    profile.weightKg <= 250 &&
    profile.heightCm >= 100 &&
    profile.heightCm <= 250 &&
    profile.age >= 14
  )
}
