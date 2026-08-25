export type Sex = 'male' | 'female'

export type NutritionGoal = 'maintain' | 'cut' | 'bulk'

/** Niveau d’activité IOM : 1 (sédentaire) … 4 (très actif). */
export type ActivityLevel = 1 | 2 | 3 | 4

export type EffortIntensity = 'low' | 'moderate' | 'high'

export interface NutritionEngineInput {
  sex: Sex
  age: number
  weight_kg: number
  /** Taille en mètres (spec : 1–2,5 m). */
  height_m: number
  activity: ActivityLevel
  goal: NutritionGoal
  deficit_kcal: number
  surplus_kcal: number
  sport_principal: string | null
  sport_secondaire: string | null
  /** Durée effort (h) — recommandations hydratation uniquement. */
  duration_h: number
  /** Intensité effort — recommandations intra-effort uniquement. */
  intensity: EffortIntensity | null
  /** Perte de poids pendant l’effort (kg) — recommandations post-effort uniquement. */
  effort_weight_loss_kg: number
  /** @deprecated Alias legacy — préférer effort_weight_loss_kg. */
  effort_fluid_loss_l: number
}

export interface MacroGrams {
  proteines_g: number
  lipides_g: number
  glucides_g: number
}

export interface MacroFloorsAndTargets {
  prot_min_g: number
  prot_target_g: number
  lip_min_g: number
  lip_target_g: number
  gluc_min_g: number
  gluc_target_g: number
}

export interface NutritionEngineSuccess {
  ok: true
  eer_kcal: number
  target_kcal: number
  bcmr_kcal: number
  kcal_dispo: number
  macros: MacroGrams
  macros_kcal: {
    proteines_kcal: number
    lipides_kcal: number
    glucides_kcal: number
  }
  constraints: MacroFloorsAndTargets
  recommendations: string[]
}

export interface NutritionEngineFailure {
  ok: false
  httpStatus: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export type NutritionEngineResult = NutritionEngineSuccess | NutritionEngineFailure
