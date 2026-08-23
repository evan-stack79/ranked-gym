import type { ScheduledSession, WorkoutRoutine } from '../types/training'
import { DEFAULT_ROUTINES } from '../services/trainingStorage'

export type ProgramSplit = 'upper_lower' | 'push_pull' | 'full'

const DEFAULT_IDS = new Set(DEFAULT_ROUTINES.map((r) => r.id))

const SPLIT_ROUTINE_IDS: Record<ProgramSplit, Set<string>> = {
  upper_lower: new Set(['upper', 'lower', 'full']),
  push_pull: new Set(['push', 'pull', 'legs', 'full']),
  full: DEFAULT_IDS,
}

/** Déduit le split actif depuis l’agenda ou les routines utilisées. */
export function detectProgramSplit(
  schedule: ScheduledSession[],
  routines: WorkoutRoutine[],
): ProgramSplit {
  const haystack = schedule
    .map((s) => `${s.title} ${s.templateId}`.toLowerCase())
    .join(' ')

  if (/\bpush\b|\bpull\b|poussée|tirage/.test(haystack)) {
    return 'push_pull'
  }
  if (/\bupper\b|\blower\b|haut du corps|bas du corps/.test(haystack)) {
    return 'upper_lower'
  }

  const used = routines.filter((r) => r.exercises.length > 0).map((r) => r.id)
  const usesPushPull = used.some((id) => id === 'push' || id === 'pull')
  const usesUpperLower = used.some((id) => id === 'upper' || id === 'lower')

  if (usesPushPull && !usesUpperLower) return 'push_pull'
  return 'upper_lower'
}

/** Filtre les onglets du carnet selon le programme actif (+ customs). */
export function filterRoutinesForProgram(
  routines: WorkoutRoutine[],
  split: ProgramSplit,
): WorkoutRoutine[] {
  const allowed = SPLIT_ROUTINE_IDS[split]
  return routines.filter((r) => r.id.startsWith('custom-') || allowed.has(r.id))
}
