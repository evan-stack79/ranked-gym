import type { AppDisciplineId } from '../data/disciplines'
import type { SessionKind, SessionSource } from '../types/training'

/**
 * Mappe la discipline UI active → sessionKind figé à l’écriture.
 * Ne lit jamais une note existante — métadonnée de création uniquement.
 */
export function sessionKindForDiscipline(disciplineId: AppDisciplineId): SessionKind {
  switch (disciplineId) {
    case 'musculation':
    case 'crossfit':
    case 'fitness':
      return 'strength'
    case 'course':
    case 'cyclisme':
      return 'endurance'
    case 'football':
      return 'team'
    case 'combat':
    default:
      return 'generic'
  }
}

/** Métadonnées figées pour toute saisie UI actuelle. */
export function manualSessionMeta(
  sportId: string,
  sessionKind: SessionKind,
): { sportId: string; sessionKind: SessionKind; source: SessionSource } {
  return { sportId, sessionKind, source: 'manual' }
}
