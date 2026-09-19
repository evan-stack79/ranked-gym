import { getCatalogExercise } from '../data/exerciseCatalog'
import type { ExerciseEntry } from '../types/training'

/**
 * Nom d’affichage fiable d’un exercice : catalogue via id canonique, sinon name trim.
 * Ne invente jamais un muscle / catégorie.
 */
export function resolveExerciseDisplayName(exercise: ExerciseEntry): string {
  const canonical = exercise.canonicalExerciseId?.trim()
  if (canonical) {
    const catalog = getCatalogExercise(canonical)
    if (catalog?.name?.trim()) return catalog.name.trim()
  }
  return exercise.name?.trim() || ''
}

/** Exercices « validés » = présents avec id canonique ou nom réel (pas de ligne vide). */
export function namedSessionExercises(exercises: ExerciseEntry[] | null | undefined): ExerciseEntry[] {
  if (!exercises?.length) return []
  return exercises.filter(
    (e) => Boolean(e.canonicalExerciseId?.trim()) || Boolean(e.name?.trim()),
  )
}

/**
 * Source unique du libellé séance (carte active / historique / résultat).
 *
 * - 1 exo → nom réel de l’exo (catalogue si canonique)
 * - multi → nom user si défini ; sinon « Musculation »
 * - 0 exo → nom user si défini ; sinon « Séance »
 * Jamais un muscle inventé comme titre de substitution.
 */
export function deriveSessionDisplayTitle(
  exercises: ExerciseEntry[] | null | undefined,
  userTitle?: string | null,
): string {
  const named = namedSessionExercises(exercises)
  const user = userTitle?.trim() || ''

  if (named.length === 1) {
    return resolveExerciseDisplayName(named[0]) || user || 'Musculation'
  }
  if (named.length > 1) {
    return user || 'Musculation'
  }
  return user || 'Séance'
}
