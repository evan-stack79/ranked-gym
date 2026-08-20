export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type NutritionGoal = 'cut' | 'maintain' | 'bulk'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface CalorieProfile {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
  activity: ActivityLevel
  goal: NutritionGoal
}

export interface CalorieResult {
  bmr: number
  tdee: number
  targetCalories: number
  proteinG: number
  carbsG: number
  fatG: number
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
