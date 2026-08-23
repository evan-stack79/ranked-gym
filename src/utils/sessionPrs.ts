import type { ExerciseEntry, WorkoutNote } from '../types/training'

function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function bestWeightInExercise(exercise: ExerciseEntry): number {
  let best = 0
  for (const set of exercise.sets ?? []) {
    if (typeof set.weightKg === 'number' && set.weightKg > best) {
      best = set.weightKg
    }
  }
  return best
}

function buildPriorMaxMap(notes: WorkoutNote[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const note of notes) {
    for (const exercise of note.exercises ?? []) {
      const name = normalizeExerciseName(exercise.name || '')
      if (!name) continue
      const best = bestWeightInExercise(exercise)
      if (best <= 0) continue
      map.set(name, Math.max(map.get(name) ?? 0, best))
    }
  }
  return map
}

/**
 * Compte les exercices où la séance bat le meilleur poids historique.
 * @param excludeNoteId — exclut la séance en cours d’édition du passé.
 */
export function countSessionPersonalRecords(
  sessionExercises: ExerciseEntry[],
  priorNotes: WorkoutNote[],
  excludeNoteId?: string,
): number {
  const filtered = excludeNoteId
    ? priorNotes.filter((note) => note.id !== excludeNoteId)
    : priorNotes
  const priorMax = buildPriorMaxMap(filtered)

  let prCount = 0
  for (const exercise of sessionExercises) {
    const name = normalizeExerciseName(exercise.name || '')
    if (!name) continue
    const sessionBest = bestWeightInExercise(exercise)
    if (sessionBest <= 0) continue
    const historical = priorMax.get(name) ?? 0
    if (sessionBest > historical) prCount += 1
  }
  return prCount
}
