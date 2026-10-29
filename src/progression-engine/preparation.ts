import {
  PREPARATION_WEIGHT_BANK,
  PREPARATION_WEIGHT_REGULARITY,
  PREPARATION_WEIGHT_SLEEP,
  PREPARATION_WEIGHT_YESTERDAY,
} from './constants.ts'

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Mapping jeu de la bande 7–9 h. Ce n’est pas un score de sommeil clinique. */
export function sleepQuantityGameScore(tstHours: number): number {
  if (tstHours >= 7 && tstHours <= 9) return 100
  if (tstHours < 7) return clampScore(((tstHours - 4) / 3) * 100)
  return clampScore(((12 - tstHours) / 3) * 100)
}

export function sleepBankGameScore(bankMinutes: number): number {
  return clampScore(50 + bankMinutes / 6)
}

/** σ en minutes, sans étiquette régulier / irrégulier. */
export function regularityGameScore(sigmaMinutes: number): number {
  return clampScore(100 - sigmaMinutes)
}

export function yesterdayStrainGameScore(z: number): number {
  return clampScore(70 - z * 20)
}

export interface PreparationInput {
  tstHoursToday: number | null
  sleepBankMinutes: number | null
  regularitySigmaMinutes?: number | null
  yesterdayStrainZ?: number | null
}

export interface PreparationResult {
  score: number | null
  partial: boolean
  parts: number
}

/**
 * Poids 45 / 25 / 15 / 15, renormalisés sur les signaux présents.
 * Sans TST du jour, préparation = null.
 */
export function preparationScore(input: PreparationInput): PreparationResult {
  if (input.tstHoursToday == null || !Number.isFinite(input.tstHoursToday)) {
    return { score: null, partial: true, parts: 0 }
  }
  const parts: Array<{ weight: number; score: number }> = [
    { weight: PREPARATION_WEIGHT_SLEEP, score: sleepQuantityGameScore(input.tstHoursToday) },
  ]
  if (input.sleepBankMinutes != null && Number.isFinite(input.sleepBankMinutes)) {
    parts.push({ weight: PREPARATION_WEIGHT_BANK, score: sleepBankGameScore(input.sleepBankMinutes) })
  }
  if (input.regularitySigmaMinutes != null && Number.isFinite(input.regularitySigmaMinutes)) {
    parts.push({
      weight: PREPARATION_WEIGHT_REGULARITY,
      score: regularityGameScore(input.regularitySigmaMinutes),
    })
  }
  if (input.yesterdayStrainZ != null && Number.isFinite(input.yesterdayStrainZ)) {
    parts.push({
      weight: PREPARATION_WEIGHT_YESTERDAY,
      score: yesterdayStrainGameScore(input.yesterdayStrainZ),
    })
  }
  const weight = parts.reduce((sum, part) => sum + part.weight, 0)
  const raw = parts.reduce((sum, part) => sum + part.weight * part.score, 0) / weight
  return {
    score: Math.round(raw),
    partial: parts.length < 4,
    parts: parts.length,
  }
}
