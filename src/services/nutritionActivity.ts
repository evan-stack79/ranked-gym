import type { CalorieProfile } from '../types/nutrition'
import { getCalorieProfile } from './nutritionStorage'
import { getTrainingState, todayWorkoutKcal } from './trainingStorage'
import { computeCaloriePlan, GOAL_LABELS } from '../utils/calories'
import { applyActivityToTarget, stepsToKcal } from '../utils/activityCalories'

/**
 * Single source of truth for the daily calorie target.
 * Always pass the live profile when available so UI never drifts from storage timing.
 */
export function getAdjustedNutritionTarget(profileOverride?: CalorieProfile) {
  const profile = profileOverride ?? getCalorieProfile()
  const training = getTrainingState()
  const plan = computeCaloriePlan(profile)
  const stepsKcal = stepsToKcal(training.stepsToday, profile.weightKg)
  const workoutKcal = todayWorkoutKcal(training)
  const adjusted = applyActivityToTarget(
    plan.targetCalories,
    plan.goal,
    stepsKcal + workoutKcal,
  )
  return {
    profile,
    plan,
    training,
    stepsKcal,
    workoutKcal,
    ...adjusted,
    goalLabel: GOAL_LABELS[plan.goal],
  }
}
