const EXERCISE_NAME_FIXES: Array<[RegExp, string]> = [
  [/^developer couch[ée]?$/i, 'Développé couché'],
  [/^developpe couch[ée]?$/i, 'Développé couché'],
  [/^dev couch[ée]?$/i, 'Développé couché'],
]

/** Corrige les fautes courantes sur les noms d’exercices (ex. Developer → Développé). */
export function sanitizeExerciseName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  for (const [pattern, replacement] of EXERCISE_NAME_FIXES) {
    if (pattern.test(trimmed)) return replacement
  }
  return trimmed
}

export function sanitizeExerciseEntries<T extends { name: string }>(entries: T[]): T[] {
  return entries.map((entry) => ({
    ...entry,
    name: sanitizeExerciseName(entry.name),
  }))
}
