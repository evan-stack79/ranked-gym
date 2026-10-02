import type { TrainingState, Weekday } from '../types/training'
import { getTrainingState } from '../services/trainingStorage'
import { todayKey } from './calories'
import { dedupeWorkoutNotes } from './workoutHistory'

export const WATER_ML_PER_KG = 35
export const TRAINING_DAY_WATER_BONUS_ML = 700

/** Repli quand le poids est inconnu / ≤ 0 (ex. mineur sans saisie — BUG-37). */
export const FALLBACK_WATER_WEIGHT_KG = 70

/** Objectif journalier (ml) : poids × 35 ml, +700 ml si jour d’entraînement, arrondi à 100 ml. */
export function calculateDailyWaterGoal(weightKg: number, isTrainingDay: boolean): number {
  const raw = Number(weightKg)
  // BUG-37 : poids ≤ 0 ou non fini → 70 kg (plus d’objectif 0 ml)
  const safeWeight = Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_WATER_WEIGHT_KG
  let ml = safeWeight * WATER_ML_PER_KG
  if (isTrainingDay) ml += TRAINING_DAY_WATER_BONUS_ML
  return Math.round(ml / 100) * 100
}

export function isScheduledTrainingDay(state: TrainingState, now = new Date()): boolean {
  const weekday = now.getDay() as Weekday
  return state.schedule.some((session) => session.enabled && session.days.includes(weekday))
}

export function isValidatedTrainingDay(
  state: TrainingState,
  dateKey = todayKey(),
): boolean {
  const fromNotes = dedupeWorkoutNotes(state.workoutNotes).some((note) => note.dateKey === dateKey)
  if (fromNotes) return true
  return state.completed.some((session) => session.dateKey === dateKey)
}

/** Séance prévue (agenda) ou déjà validée aujourd’hui. */
export function isTrainingDayToday(
  state: TrainingState = getTrainingState(),
  now = new Date(),
): boolean {
  const key = todayKey(now)
  if (isValidatedTrainingDay(state, key)) return true
  return isScheduledTrainingDay(state, now)
}

export function getDailyWaterGoalMl(weightKg: number, isTrainingDay?: boolean): number {
  const training = isTrainingDay ?? isTrainingDayToday()
  return calculateDailyWaterGoal(weightKg, training)
}

export function formatWaterMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(1).replace('.', ',')} L`
  }
  return `${Math.round(ml)} ml`
}
