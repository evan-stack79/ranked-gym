import { getCalorieProfile } from './nutritionStorage'
import { getTrainingState, todayWorkoutKcal } from './trainingStorage'
import { computeCaloriePlan, GOAL_LABELS } from '../utils/calories'
import {
  applyActivityToTarget,
  stepsToKcal,
} from '../utils/activityCalories'

/** Daily calorie target including steps + logged workouts, goal-aware. */
export function getAdjustedNutritionTarget() {
  const profile = getCalorieProfile()
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
