import { getCatalogExercise } from '../data/exerciseCatalog'
import type {
  ExerciseEntry,
  SessionDetails,
  SessionKind,
  WorkoutNote,
} from '../types/training'

/** Provenance du titre — additive ; absente sur les notes legacy. */
export type SessionTitleSource = 'user' | 'derived'

export const MULTI_EXERCISE_SESSION_TITLE = 'Séance musculation'
export const EMPTY_SESSION_TITLE = 'Séance'
/**
 * Titre hérité du bug (routine.label / dernier focus « Biceps »).
 * Jamais un défaut pour une nouvelle séance.
 */
export const UNPROVEN_INHERITED_TITLE = 'Biceps'

/**
 * Labels de routine / split / groupe musculaire — jamais un titre de séance
 * par défaut. Heuristique d’affichage seulement (notes legacy sans
 * `titleSource: 'user'`). Ne réécrit pas le stockage.
 * Ensemble exact, pas de fuzzy.
 */
const UNPROVEN_INHERITED_TITLES = new Set([
  UNPROVEN_INHERITED_TITLE,
  'Push',
  'Pull',
  'Upper',
  'Lower',
  'Legs',
  'Jambes',
  'Pecs',
  'Dos',
  'Épaules',
  'Bras',
  'Full body',
])

export type SessionTitleInput = {
  exercises?: ExerciseEntry[] | null
  title?: string | null
  titleSource?: SessionTitleSource | null
  sessionKind?: SessionKind | null
  details?: SessionDetails | null
}

/** Exercices nommés = id canonique ou nom réel (ignore les lignes vides). */
export function namedSessionExercises(
  exercises: ExerciseEntry[] | null | undefined,
): ExerciseEntry[] {
  if (!exercises?.length) return []
  return exercises.filter(
    (e) => Boolean(e.canonicalExerciseId?.trim()) || Boolean(e.name?.trim()),
  )
}

/**
 * Nom d’affichage d’un exercice : catalogue via id canonique, sinon `name` trim.
 * Ne dérive jamais depuis un muscle / une icône / une catégorie.
 */
export function resolveExerciseDisplayName(exercise: ExerciseEntry): string {
  const canonical = exercise.canonicalExerciseId?.trim()
  if (canonical) {
    const catalog = getCatalogExercise(canonical)
    if (catalog?.name?.trim()) return catalog.name.trim()
  }
  return exercise.name?.trim() || ''
}

/**
 * Titre dérivé uniquement des exercices enregistrés.
 * 1 exo → vrai nom ; plusieurs → « Séance musculation » ; 0 → « Séance ».
 */
export function deriveSessionTitleFromExercises(
  exercises: ExerciseEntry[] | null | undefined,
): string {
  const named = namedSessionExercises(exercises)
  if (named.length === 1) {
    return resolveExerciseDisplayName(named[0]) || EMPTY_SESSION_TITLE
  }
  if (named.length > 1) return MULTI_EXERCISE_SESSION_TITLE
  return EMPTY_SESSION_TITLE
}

export function isStrengthTitleScope(input: {
  sessionKind?: SessionKind | null
  details?: SessionDetails | null
}): boolean {
  if (
    input.sessionKind === 'endurance' ||
    input.sessionKind === 'team' ||
    input.sessionKind === 'generic'
  ) {
    return false
  }
  if (input.details?.kind === 'endurance' || input.details?.kind === 'team') {
    return false
  }
  return true
}

/**
 * Heuristique anciennes séances — affichage UI seulement, jamais d’écriture en base.
 *
 * Un nom est **volontaire prouvé** ssi `titleSource === 'user'` et titre non vide.
 * - `titleSource === 'derived'` : déjà calculé à la persistance → on affiche le stocké
 *   (sauf un label de groupe / split, qui n’est jamais un dérivé légitime).
 * - Legacy (`titleSource` absent) + titre stocké exactement « Biceps » / « Push »
 *   / autre label de routine connu → origine non prouvée (héritage
 *   `routine.label`) → dériver depuis les exercices réellement enregistrés.
 * - Legacy + tout autre titre (ex. « Push du soir ») → conserver : on ne peut
 *   pas prouver que ce n’était pas un nom volontaire.
 */
export function isUnprovenBicepsBugTitle(
  title: string | null | undefined,
  titleSource?: SessionTitleSource | null,
): boolean {
  if (titleSource === 'user') return false
  return UNPROVEN_INHERITED_TITLES.has((title ?? '').trim())
}

/** Source unique d’affichage (historique, hub, pump check). */
export function deriveSessionDisplayTitle(input: SessionTitleInput): string {
  const trimmed = input.title?.trim() ?? ''

  if (!isStrengthTitleScope(input)) {
    return trimmed || EMPTY_SESSION_TITLE
  }

  if (input.titleSource === 'user' && trimmed) {
    return trimmed
  }

  if (isUnprovenBicepsBugTitle(input.title, input.titleSource) || !trimmed) {
    return deriveSessionTitleFromExercises(input.exercises)
  }

  if (input.titleSource === 'derived') {
    return trimmed
  }

  return trimmed
}

/**
 * Titre à persister. Nouvelles séances force : jamais « Biceps » par défaut.
 * Éditions : pas de migration destructive du titre stocké.
 */
export function resolvePersistedSessionTitle(
  input: SessionTitleInput,
  existing?: Pick<WorkoutNote, 'title' | 'titleSource'> | null,
): { title: string; titleSource?: SessionTitleSource } {
  if (existing) {
    if (input.titleSource === 'user' && input.title?.trim()) {
      return { title: input.title.trim(), titleSource: 'user' }
    }
    const title = input.title?.trim() || existing.title
    const titleSource = input.titleSource ?? existing.titleSource
    return titleSource ? { title, titleSource } : { title }
  }

  if (!isStrengthTitleScope(input)) {
    const title = input.title?.trim() || EMPTY_SESSION_TITLE
    return input.titleSource ? { title, titleSource: input.titleSource } : { title }
  }

  if (input.titleSource === 'user' && input.title?.trim()) {
    return { title: input.title.trim(), titleSource: 'user' }
  }

  return {
    title: deriveSessionTitleFromExercises(input.exercises),
    titleSource: 'derived',
  }
}

/**
 * Résumé d’exercices pour la ligne historique.
 * Omis s’il duplique le titre (1 seul exo). Vide → null.
 */
export function formatHistoryExerciseSummary(input: SessionTitleInput): string | null {
  const names = namedSessionExercises(input.exercises)
    .map((exercise) => resolveExerciseDisplayName(exercise))
    .filter(Boolean)
  if (names.length === 0) return null
  const title = deriveSessionDisplayTitle(input)
  if (names.length === 1 && names[0] === title) return null
  return names.join(' · ')
}
