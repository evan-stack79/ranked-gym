import type { BodyMorphology, MealType } from '../types/nutrition'
import { foodShareForMode, MEAL_SHARE_BY_MORPHOLOGY, type PortionMode } from './morphology'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * Allocate daily calories across meals so the sum is *exactly* dailyTarget
 * (largest-remainder method — no drift from independent Math.round).
 */
export function allocateMealBudgets(
  dailyTarget: number,
  morphology: BodyMorphology = 'mesomorph',
): Record<MealType, number> {
  const target = Math.max(0, Math.round(dailyTarget))
  const shares = MEAL_SHARE_BY_MORPHOLOGY[morphology]
  const rows = MEAL_ORDER.map((mealType) => {
    const exact = target * shares[mealType]
    const floor = Math.floor(exact)
    return { mealType, exact, floor, frac: exact - floor }
  })
  let used = rows.reduce((sum, r) => sum + r.floor, 0)
  let left = target - used
  const byFrac = [...rows].sort((a, b) => b.frac - a.frac || a.exact - b.exact)
  const budgets: Record<MealType, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  }
  for (const row of rows) budgets[row.mealType] = row.floor
  for (const row of byFrac) {
    if (left <= 0) break
    budgets[row.mealType] += 1
    left -= 1
  }
  return budgets
}

export function mealCalorieBudget(
  dailyTarget: number,
  mealType: MealType,
  morphology: BodyMorphology = 'mesomorph',
): number {
  return allocateMealBudgets(dailyTarget, morphology)[mealType]
}

/** Soft range around the meal target so people know “about how much” to eat. */
export function mealCalorieRange(budget: number): { min: number; max: number; target: number } {
  const min = Math.max(80, Math.round(budget * 0.85))
  const max = Math.round(budget * 1.15)
  return { min, max, target: budget }
}

export function usedMealCalories(
  mealType: MealType,
  meals: Array<{ mealType: MealType; calories: number }>,
): number {
  return meals
    .filter((meal) => meal.mealType === mealType)
    .reduce((sum, meal) => sum + meal.calories, 0)
}

export function remainingMealBudget(
  dailyTarget: number,
  mealType: MealType,
  meals: Array<{ mealType: MealType; calories: number }>,
  morphology: BodyMorphology = 'mesomorph',
): number {
  const budget = mealCalorieBudget(dailyTarget, mealType, morphology)
  return Math.max(0, budget - usedMealCalories(mealType, meals))
}

export function allMealBudgets(
  dailyTarget: number,
  morphology: BodyMorphology,
  meals: Array<{ mealType: MealType; calories: number }>,
) {
  const budgets = allocateMealBudgets(dailyTarget, morphology)
  const sumBudgets = MEAL_ORDER.reduce((s, t) => s + budgets[t], 0)
  return {
    rows: MEAL_ORDER.map((mealType) => {
      const budget = budgets[mealType]
      const range = mealCalorieRange(budget)
      const used = usedMealCalories(mealType, meals)
      const remaining = Math.max(0, budget - used)
      return { mealType, budget, range, used, remaining }
    }),
    sumBudgets,
    dailyTarget: Math.round(dailyTarget),
  }
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
