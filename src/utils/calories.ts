import type {
  ActivityLevel,
  CalorieProfile,
  CalorieResult,
  NutritionGoal,
  Sex,
} from '../types/nutrition'

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
}

const GOAL_ADJUSTMENT: Record<NutritionGoal, number> = {
  cut: -0.18,
  maintain: 0,
  bulk: 0.12,
}

/** Mifflin-St Jeor BMR */
export function computeBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function computeCaloriePlan(profile: CalorieProfile): CalorieResult {
  const bmr = computeBmr(profile.weightKg, profile.heightCm, profile.age, profile.sex)
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[profile.activity])
  const targetCalories = Math.round(tdee * (1 + GOAL_ADJUSTMENT[profile.goal]))

  // Classic physique macros: ~2g/kg protein, 25% calories from fat, rest carbs
  const proteinG = Math.round(profile.weightKg * 2)
  const fatG = Math.round((targetCalories * 0.25) / 9)
  const carbsG = Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4))

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sédentaire',
  light: 'Léger',
  moderate: 'Modéré',
  active: 'Actif',
  athlete: 'Athlète',
}

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  cut: 'Sèche',
  maintain: 'Maintien',
  bulk: 'Prise',
}

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Petit-déj',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}
