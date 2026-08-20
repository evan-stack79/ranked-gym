import type { BodyMorphology, MealType } from '../types/nutrition'
import { foodShareForMode, MEAL_SHARE_BY_MORPHOLOGY, type PortionMode } from './morphology'

export function mealCalorieBudget(
  dailyTarget: number,
  mealType: MealType,
  morphology: BodyMorphology = 'mesomorph',
): number {
  const share = MEAL_SHARE_BY_MORPHOLOGY[morphology][mealType]
  return Math.round(dailyTarget * share)
}

export function remainingMealBudget(
  dailyTarget: number,
  mealType: MealType,
  meals: Array<{ mealType: MealType; calories: number }>,
  morphology: BodyMorphology = 'mesomorph',
): number {
  const budget = mealCalorieBudget(dailyTarget, mealType, morphology)
  const used = meals
    .filter((meal) => meal.mealType === mealType)
    .reduce((sum, meal) => sum + meal.calories, 0)
  return Math.max(0, budget - used)
}

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

export function suggestedGramsForScan(options: {
  kcalPer100g: number
  remainingKcal: number
  mode: PortionMode
  morphology: BodyMorphology
}): number | null {
  const share = foodShareForMode(options.mode, options.morphology)
  return suggestedGramsForProduct(options.kcalPer100g, options.remainingKcal, share)
}

export function isCalorieDense(kcalPer100g: number): boolean {
  return kcalPer100g >= 350
}

export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return '—'
  return String(Math.round(grams * 100) / 100)
}

export function scaleNutrition(
  per100: { calories: number; proteines: number; glucides: number; lipides: number },
  grams: number,
) {
  const factor = grams / 100
  return {
    calories: Math.max(0, Math.round(per100.calories * factor)),
    proteines: Math.round(per100.proteines * factor * 100) / 100,
    glucides: Math.round(per100.glucides * factor * 100) / 100,
    lipides: Math.round(per100.lipides * factor * 100) / 100,
  }
}
