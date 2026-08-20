import type { MealType } from '../types/nutrition'

/** Share of daily calories reserved per meal — leaves room for a balanced plate. */
export const MEAL_CALORIE_SHARE: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
}

export function mealCalorieBudget(dailyTarget: number, mealType: MealType): number {
  return Math.round(dailyTarget * MEAL_CALORIE_SHARE[mealType])
}

export function remainingMealBudget(
  dailyTarget: number,
  mealType: MealType,
  meals: Array<{ mealType: MealType; calories: number }>,
): number {
  const budget = mealCalorieBudget(dailyTarget, mealType)
  const used = meals
    .filter((meal) => meal.mealType === mealType)
    .reduce((sum, meal) => sum + meal.calories, 0)
  return Math.max(0, budget - used)
}

/**
 * Suggest grams so this food uses part of the remaining meal budget
 * (not 100% — leave space for a balanced plate: protein, veggies, etc.).
 */
export function suggestedGramsForProduct(
  kcalPer100g: number,
  remainingKcal: number,
  foodShareOfMeal = 0.65,
): number | null {
  if (!(kcalPer100g > 0) || !(remainingKcal > 0)) return null
  const targetKcal = remainingKcal * foodShareOfMeal
  const grams = (targetKcal / kcalPer100g) * 100
  if (!Number.isFinite(grams) || grams <= 0) return null
  return Math.round(grams * 100) / 100
}

export function isCalorieDense(kcalPer100g: number): boolean {
  return kcalPer100g >= 350
}

export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return '—'
  return String(Math.round(grams * 100) / 100)
}
