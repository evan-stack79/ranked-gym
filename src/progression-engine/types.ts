export type LoadMode = 'external' | 'bodyweight' | 'machine' | 'assisted_bodyweight'

export type StrainBand = 'below' | 'within' | 'above'

export type LoadStatus = 'detraining' | 'productive' | 'excess'

export interface StrengthSetInput {
  reps: number
  /** Charge affichée. Pour une assistée : poids d’aide, pas la charge nette. */
  loggedKg: number
  rpe?: number | null
  /** Absent = série comptée (notes legacy sans drapeau done). */
  done?: boolean
  loadMode?: LoadMode
  /**
   * Muscles du catalogue, le premier est le primaire.
   * Un seul muscle reçoit 100 % de la charge.
   */
  muscles?: string[]
}

export interface StrainBaseline {
  mean: number
  sd: number
  sampleCount: number
}

export interface BuildProgressionInput {
  sets: StrengthSetInput[]
  bodyweightKg?: number | null
  hadPr?: boolean
  /** Médiane du strain brut sur 28 jours. null = cold start, échelle 150. */
  medianStrainRaw28: number | null
  baseline?: StrainBaseline | null
  /** TST en heures, du plus ancien au plus récent. null = TST inconnu, ignoré. */
  tstHoursLast7: Array<number | null>
  sleepGoalMinutes?: number
  /** σ circulaire en minutes. Absent = composante omise. Pas de seuil clinique. */
  regularitySigmaMinutes?: number | null
  /** z de la veille. Absent = composante omise. */
  yesterdayStrainZ?: number | null
  performanceRating?: number
  ratedSessions?: number
}

export interface MuscleShare {
  muscle: string
  share: number
}

export interface ProgressionDay {
  rawStrainUnits: number
  strainScale: number
  /** Strain affiché 0–100, arrondi. null seulement si aucune série valide. */
  workoutStrain: number | null
  strainZ: number | null
  strainBand: StrainBand | null
  targetLow: number | null
  targetHigh: number | null
  sleepBankMinutes: number | null
  preparation: number | null
  preparationPartial: boolean
  muscleFreshness: Record<string, number> | null
  xp: number
  strainXp: number
  xpMultiplier: number
  performanceRating: number
  ratedSessions: number
}
