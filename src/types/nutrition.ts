export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type NutritionGoal = 'cut' | 'maintain' | 'bulk'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
/** Somatotype — used to adapt meal size & scan guidance (not a medical label). */
export type BodyMorphology = 'ectomorph' | 'mesomorph' | 'endomorph'

export interface CalorieProfile {
  weightKg: number
  goalWeightKg: number
  heightCm: number
  age: number
  sex: Sex
  activity: ActivityLevel
  morphology: BodyMorphology
  /** Explicit user choice: cut | maintain | bulk */
  goal: NutritionGoal
  /**
   * Absolute weekly pace in kg/week chosen by the user (e.g. 0.5).
   * Sign is applied from `goal` (negative on cut, positive on bulk).
   */
  weeklyPaceKg: number
  onboardingComplete: boolean
}

export interface CalorieResult {
  bmr: number
  tdee: number
  targetCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  goal: NutritionGoal
  deltaKg: number
  weeklyChangeKg: number
  estimatedWeeks: number | null
}

export interface MealEntry {
  id: string
  name: string
  mealType: MealType
  calories: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  /** Portion weight when logged from a scale / scan / piece count */
  grams?: number
  /** Number of pieces when logged without a scale (nuggets, boulettes…) */
  pieces?: number
  /** How the user intended this food in the meal */
  portionMode?: 'solo' | 'with_sides'
  createdAt: number
}

export interface DayJournal {
  dateKey: string
  meals: MealEntry[]
}
