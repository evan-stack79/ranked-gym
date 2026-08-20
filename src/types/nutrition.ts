export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type NutritionGoal = 'cut' | 'maintain' | 'bulk'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface CalorieProfile {
  weightKg: number
  goalWeightKg: number
  heightCm: number
  age: number
  sex: Sex
  activity: ActivityLevel
  /** Derived from current vs goal weight, but overridable */
  goal: NutritionGoal
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
  createdAt: number
}

export interface DayJournal {
  dateKey: string
  meals: MealEntry[]
}
