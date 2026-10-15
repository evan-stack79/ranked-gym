import type { TrainingState, Weekday } from '../types/training'
import { getTrainingState } from '../services/trainingStorage'
import { todayKey } from './calories'
import { dedupeWorkoutNotes } from './workoutHistory'

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

export function formatWaterMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(1).replace('.', ',')} L`
  }
  return `${Math.round(ml)} ml`
}
