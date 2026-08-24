import { ERROR_CODES, engineError } from './errors'
import type { NutritionEngineFailure, NutritionEngineInput } from './types'

const LIMITS = {
  age: { min: 18, max: 120 },
  weight_kg: { min: 30, max: 250 },
  height_m: { min: 1, max: 2.5 },
  activity: { min: 1, max: 4 },
  deficit_kcal: { min: 0, max: 2000 },
  surplus_kcal: { min: 0, max: 1000 },
  duration_h: { min: 0, max: 10 },
  effort_fluid_loss_l: { min: 0 },
} as const

function rangeError(
  field: string,
  code: string,
  value: unknown,
  min: number,
  max?: number,
): NutritionEngineFailure {
  const message =
    max != null
      ? `${field} doit être entre ${min} et ${max} (reçu : ${String(value)})`
      : `${field} doit être ≥ ${min} (reçu : ${String(value)})`
  return engineError(code as never, message, 400, { field, value, min, max })
}

export function validateInput(input: NutritionEngineInput): NutritionEngineFailure | null {
  const { age, weight_kg, height_m, activity, deficit_kcal, surplus_kcal, duration_h, effort_fluid_loss_l } =
    input

  if (input.sex !== 'male' && input.sex !== 'female') {
    return engineError(ERROR_CODES.INVALID_SEX, 'sex doit être "male" ou "female"', 400)
  }

  if (input.goal !== 'maintain' && input.goal !== 'cut' && input.goal !== 'bulk') {
    return engineError(ERROR_CODES.INVALID_GOAL, 'goal doit être maintain, cut ou bulk', 400)
  }

  if (!Number.isFinite(age) || age < LIMITS.age.min || age > LIMITS.age.max) {
    return rangeError('age', ERROR_CODES.INVALID_AGE, age, LIMITS.age.min, LIMITS.age.max)
  }

  if (!Number.isFinite(weight_kg) || weight_kg < LIMITS.weight_kg.min || weight_kg > LIMITS.weight_kg.max) {
    return rangeError(
      'weight_kg',
      ERROR_CODES.INVALID_WEIGHT,
      weight_kg,
      LIMITS.weight_kg.min,
      LIMITS.weight_kg.max,
    )
  }

  if (!Number.isFinite(height_m) || height_m < LIMITS.height_m.min || height_m > LIMITS.height_m.max) {
    return rangeError(
      'height_m',
      ERROR_CODES.INVALID_HEIGHT,
      height_m,
      LIMITS.height_m.min,
      LIMITS.height_m.max,
    )
  }

  if (!Number.isInteger(activity) || activity < LIMITS.activity.min || activity > LIMITS.activity.max) {
    return rangeError(
      'activity',
      ERROR_CODES.INVALID_ACTIVITY,
      activity,
      LIMITS.activity.min,
      LIMITS.activity.max,
    )
  }

  if (!Number.isFinite(deficit_kcal) || deficit_kcal < LIMITS.deficit_kcal.min || deficit_kcal > LIMITS.deficit_kcal.max) {
    return rangeError(
      'deficit_kcal',
      ERROR_CODES.INVALID_DEFICIT,
      deficit_kcal,
      LIMITS.deficit_kcal.min,
      LIMITS.deficit_kcal.max,
    )
  }

  if (!Number.isFinite(surplus_kcal) || surplus_kcal < LIMITS.surplus_kcal.min || surplus_kcal > LIMITS.surplus_kcal.max) {
    return rangeError(
      'surplus_kcal',
      ERROR_CODES.INVALID_SURPLUS,
      surplus_kcal,
      LIMITS.surplus_kcal.min,
      LIMITS.surplus_kcal.max,
    )
  }

  if (!Number.isFinite(duration_h) || duration_h < LIMITS.duration_h.min || duration_h > LIMITS.duration_h.max) {
    return rangeError(
      'duration_h',
      ERROR_CODES.INVALID_DURATION,
      duration_h,
      LIMITS.duration_h.min,
      LIMITS.duration_h.max,
    )
  }

  if (!Number.isFinite(effort_fluid_loss_l) || effort_fluid_loss_l < LIMITS.effort_fluid_loss_l.min) {
    return rangeError(
      'effort_fluid_loss_l',
      ERROR_CODES.INVALID_FLUID_LOSS,
      effort_fluid_loss_l,
      LIMITS.effort_fluid_loss_l.min,
    )
  }

  return null
}
