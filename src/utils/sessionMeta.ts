import type { AppDisciplineId } from '../data/disciplines'
import type {
  EnduranceSessionDetails,
  SessionKind,
  SessionSource,
} from '../types/training'

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

/**
 * Construit des détails endurance valides.
 * Retourne null si distanceKm n’est pas un nombre fini strictement positif.
 */
export function buildEnduranceDetails(distanceKm: number): EnduranceSessionDetails | null {
  if (!(Number.isFinite(distanceKm) && distanceKm > 0)) return null
  return { kind: 'endurance', distanceKm }
}

/**
 * Allure en secondes / km depuis durée et distance.
 * Retourne null (jamais NaN / Infinity) si les entrées sont invalides.
 */
export function paceSecPerKmFromDuration(
  durationMin: number,
  distanceKm: number,
): number | null {
  if (!(Number.isFinite(durationMin) && durationMin > 0)) return null
  if (!(Number.isFinite(distanceKm) && distanceKm > 0)) return null
  const pace = (durationMin * 60) / distanceKm
  if (!(Number.isFinite(pace) && pace > 0)) return null
  return pace
}
