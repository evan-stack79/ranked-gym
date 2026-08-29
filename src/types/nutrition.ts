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

/** Compteurs journaliers des raccourcis d’hydratation (verre, shaker…). */
export type WaterPresetsCount = Record<string, number>

/** Type de contenant / source d’une entrée d’hydratation. */
export type WaterEntryType = 'glass' | 'shaker' | 'bottle' | 'manual' | 'legacy'

/**
 * Ligne du journal d’hydratation du jour.
 * Persistée dans `nutrition.journal[date].waterEntries` (JSON Supabase).
 */
export interface WaterEntry {
  id: string
  /** Volume de cette prise (ml). */
  amountMl: number
  /** Epoch ms — affichage heure locale. */
  createdAt: number
  type: WaterEntryType
  /** Libellé UI (ex. « Bouteille »). */
  label: string
}

export interface DayJournal {
  dateKey: string
  meals: MealEntry[]
  /** Eau bue aujourd’hui (ml) — somme des waterEntries, sync cloud. */
  waterMl?: number
  /**
   * Journal d’hydratation du jour (source de vérité).
   * Option B : tableau JSON dans nutrition.journal.
   */
  waterEntries?: WaterEntry[]
  /**
   * @deprecated Dérivé de waterEntries — conservé pour migration / badges.
   */
  waterPresetsCount?: WaterPresetsCount
  /**
   * Phase technique de la bouteille active : ml déjà bus (0–1500), pas les ml restants UI.
   * En calibrage : `waterBottleLevelMl = capacity − remainingMl`.
   * Legacy : peut exister seul (sans `waterBottleCalibrationTotalMl`).
   */
  waterBottleLevelMl?: number
  /**
   * Ancre de calibrage : total du journal (`waterMl`) au moment du réglage.
   * Présent uniquement en mode calibré — avec `waterBottleLevelMl`, permet de
   * faire baisser/monter le niveau affiché quand le journal change, sans créer d’eau.
   */
  waterBottleCalibrationTotalMl?: number
}
