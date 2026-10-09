/**
 * Progression hebdo Train — compte les séances via dateKey Europe/Paris.
 * Ne touche jamais aux points classement.
 */

import { isDateKeyInParisWeek, parisDateKey } from '../utils/parisDate'
import type { WorkoutNote } from '../types/training'
import { dedupeWorkoutNotes } from '../utils/workoutHistory'
import { resolveWeeklySessionGoal, type WeeklySessionGoalRecord } from './trainWeeklyGoal'

export function noteParisDateKey(note: Pick<WorkoutNote, 'dateKey' | 'createdAt'>): string | null {
  if (typeof note.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(note.dateKey)) {
    return note.dateKey
  }
  if (typeof note.createdAt === 'number' && note.createdAt > 0) {
    return parisDateKey(note.createdAt)
  }
  return null
}

export function countSessionsInParisWeek(
  notes: WorkoutNote[],
  now: Date | number = new Date(),
): number {
  let n = 0
  for (const note of dedupeWorkoutNotes(notes)) {
    const key = noteParisDateKey(note)
    if (key && isDateKeyInParisWeek(key, now)) n += 1
  }
  return n
}

export function weeklyGoalProgress(
  notes: WorkoutNote[],
  goal: WeeklySessionGoalRecord | null | undefined,
  now: Date | number = new Date(),
): { done: number; target: number; ratio: number } {
  const target = resolveWeeklySessionGoal(goal)
  const done = countSessionsInParisWeek(notes, now)
  return { done, target, ratio: target > 0 ? Math.min(1, done / target) : 0 }
}

/** Page Train « vide » : aucune séance cette semaine (Paris). */
export function isTrainWeekEmpty(notes: WorkoutNote[], now: Date | number = new Date()): boolean {
  return countSessionsInParisWeek(notes, now) === 0
}
