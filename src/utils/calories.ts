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

/** Mifflin-St Jeor BMR */
export function computeBmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

/** Infer cut / maintain / bulk from current vs goal weight. */
export function inferGoalFromWeights(currentKg: number, goalKg: number): NutritionGoal {
  const delta = goalKg - currentKg
  if (Math.abs(delta) < 0.5) return 'maintain'
  return delta < 0 ? 'cut' : 'bulk'
}

/**
 * Calorie adjustment based on how far the goal is.
 * ~7700 kcal ≈ 1 kg of body mass (rule of thumb).
 * We target ~0.5 kg/week loss or ~0.25 kg/week gain, capped safely.
 */
export function calorieAdjustmentForGoal(
  currentKg: number,
  goalKg: number,
  tdee: number,
): { goal: NutritionGoal; targetCalories: number; weeklyChangeKg: number } {
  const delta = goalKg - currentKg
  const goal = inferGoalFromWeights(currentKg, goalKg)

  if (goal === 'maintain') {
    return { goal, targetCalories: tdee, weeklyChangeKg: 0 }
  }

  if (goal === 'cut') {
    const weeklyLoss = Math.min(0.7, Math.max(0.35, Math.abs(delta) / 12))
    const dailyDeficit = Math.round((weeklyLoss * 7700) / 7)
    const cappedDeficit = Math.min(dailyDeficit, Math.round(tdee * 0.25))
    return {
      goal,
      targetCalories: Math.max(1200, tdee - cappedDeficit),
      weeklyChangeKg: -weeklyLoss,
    }
  }

  const weeklyGain = Math.min(0.4, Math.max(0.2, Math.abs(delta) / 16))
  const dailySurplus = Math.round((weeklyGain * 7700) / 7)
  const cappedSurplus = Math.min(dailySurplus, Math.round(tdee * 0.15))
  return {
    goal,
    targetCalories: tdee + cappedSurplus,
    weeklyChangeKg: weeklyGain,
  }
}

export function computeCaloriePlan(profile: CalorieProfile): CalorieResult {
  const bmr = computeBmr(profile.weightKg, profile.heightCm, profile.age, profile.sex)
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[profile.activity])
  const { goal, targetCalories, weeklyChangeKg } = calorieAdjustmentForGoal(
    profile.weightKg,
    profile.goalWeightKg,
    tdee,
  )

  const proteinG = Math.round(profile.weightKg * (goal === 'cut' ? 2.2 : 2))
  const fatG = Math.round((targetCalories * 0.25) / 9)
  const carbsG = Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4))
  const deltaKg = Math.round((profile.goalWeightKg - profile.weightKg) * 10) / 10

  let estimatedWeeks: number | null = null
  if (weeklyChangeKg !== 0) {
    estimatedWeeks = Math.max(1, Math.ceil(Math.abs(deltaKg) / Math.abs(weeklyChangeKg)))
  }

  return {
    bmr,
    tdee,
    targetCalories,
    proteinG,
    carbsG,
    fatG,
    goal,
    deltaKg,
    weeklyChangeKg,
    estimatedWeeks,
  }
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

/** Short hint shown under the selected activity chip — motivational, health-first. */
export const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary:
    'Peu de sport pour l’instant — marche, quotidien, ou juste démarrer. Chaque pas compte pour ta santé.',
  light:
    '1 à 2 séances par semaine — parfait pour progresser à ton rythme et prendre de bonnes habitudes.',
  moderate:
    'Environ 3 séances par semaine — un bon équilibre sport / récup pour rester en forme.',
  active:
    'Environ 4 séances par semaine — rythme régulier et motivant, avec des jours pour récupérer.',
  athlete:
    '5 à 6+ séances par semaine — rythme très engagé. La récupération fait aussi partie de la progression et de la santé.',
}

export const ACTIVITY_ORDER: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'athlete',
]

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
