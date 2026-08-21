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

/** Fallback only — prefer the explicit `goal` saved on the profile. */
export function inferGoalFromWeights(currentKg: number, goalKg: number): NutritionGoal {
  const delta = goalKg - currentKg
  if (Math.abs(delta) < 0.5) return 'maintain'
  return delta < 0 ? 'cut' : 'bulk'
}

/**
 * Calorie adjustment from the user's explicit goal + weekly pace (kg/week).
 */
export function calorieAdjustmentForGoal(
  profile: CalorieProfile,
  tdee: number,
): { goal: NutritionGoal; targetCalories: number; weeklyChangeKg: number } {
  const goal = profile.goal
  const paceMag = Math.max(0, parseFloat(String(profile.weeklyPaceKg || 0)) || 0)

  if (goal === 'maintain' || paceMag === 0) {
    return { goal: 'maintain', targetCalories: tdee, weeklyChangeKg: 0 }
  }

  const weeklyChangeKg = goal === 'cut' ? -paceMag : paceMag

  if (goal === 'cut') {
    const dailyDeficit = Math.round((paceMag * 7700) / 7)
    const cappedDeficit = Math.min(dailyDeficit, Math.round(tdee * 0.25))
    return {
      goal,
      targetCalories: Math.max(1200, tdee - cappedDeficit),
      weeklyChangeKg,
    }
  }

  const dailySurplus = Math.round((paceMag * 7700) / 7)
  const cappedSurplus = Math.min(dailySurplus, Math.round(tdee * 0.15))
  return {
    goal,
    targetCalories: tdee + cappedSurplus,
    weeklyChangeKg,
  }
}

export function computeCaloriePlan(profile: CalorieProfile): CalorieResult {
  const weight = parseFloat(String(profile.weightKg)) || 0
  const height = parseFloat(String(profile.heightCm)) || 0
  const age = parseFloat(String(profile.age)) || 0
  const goalWeight = parseFloat(String(profile.goalWeightKg)) || weight

  const bmr = computeBmr(weight, height, age, profile.sex)
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[profile.activity])
  const { goal, targetCalories, weeklyChangeKg } = calorieAdjustmentForGoal(profile, tdee)

  const proteinG = Math.round(weight * (goal === 'cut' ? 2.2 : 2))
  const fatG = Math.round((targetCalories * 0.25) / 9)
  const carbsG = Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4))
  const deltaKg = Math.round((goalWeight - weight) * 10) / 10

  let estimatedWeeks: number | null = null
  if (weeklyChangeKg !== 0 && deltaKg !== 0) {
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
  bulk: 'Prise de masse',
}

export const WEEKLY_PACE_OPTIONS_KG = [0.2, 0.3, 0.4, 0.5, 0.6, 0.75] as const

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Petit-déj',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}
