/**
 * Sleep Engine V1 — types.
 * Moteur pur : aucun I/O, aucune dépendance UI/Supabase/nutrition.
 */

/** Classification quantité (TST) — statut scientifique discret, pas un score clinique 0–100. */
export type SleepQuantityStatus = 'optimal' | 'deficit' | 'excess'

export interface SleepInput {
  /** Heure de coucher (ISO datetime ou HH:MM / HH:MM:SS). */
  bedtime: string
  /** Heure de lever (ISO datetime ou HH:MM / HH:MM:SS). */
  waketime: string
  /** Total Sleep Time en heures. */
  tstHours: number
  /** Historique des couchers (fenêtre glissante). */
  historicalBedtimes?: string[]
  /** Historique des levers. */
  historicalWaketimes?: string[]
  /** TST des jours travaillés (heures) — catch-up. */
  workdayTstHours?: number[]
  /** Time In Bed courant (heures), si disponible. */
  currentTibHours?: number
}

export interface SleepQuantityResult {
  scientific_status: SleepQuantityStatus
  tstHours: number
}

/**
 * Variabilité circulaire brute.
 * Aucune classification clinique de « régularité » n’est inventée en V1
 * (seuil non justifié scientifiquement dans la spec).
 */
export interface SleepRegularityMetrics {
  bedtimeVariabilityMinutes: number | null
  waketimeVariabilityMinutes: number | null
  /** true si l’historique est insuffisant pour une dispersion fiable. */
  insufficientHistory: boolean
  sampleCountBedtime: number
  sampleCountWaketime: number
}

export interface SleepEfficiencyResult {
  sleepEfficiencyPercent: number | null
  /** Comparaison informative au seuil clinique 85 % (restriction TIB) — pas une définition universelle de qualité. */
  aboveClinicalTibRestrictionThreshold85: boolean | null
}

export interface CatchUpSleepResult {
  recoveryNeeded: boolean
  workdayAverageTstHours: number | null
  recommendation?: string
}

export interface SleepMetrics {
  quantity: SleepQuantityResult
  regularity: SleepRegularityMetrics
  efficiency: SleepEfficiencyResult
  catchUp: CatchUpSleepResult
  /** TIB dérivé bedtime→waketime (h) si timestamps complets, sinon null. */
  derivedTibHours: number | null
}

export interface SleepEngineSuccess {
  ok: true
  status: SleepQuantityStatus
  metrics: SleepMetrics
  recommendations: string[]
  warnings: string[]
}

export interface SleepEngineFailure {
  ok: false
  httpStatus: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export type SleepEngineResult = SleepEngineSuccess | SleepEngineFailure
