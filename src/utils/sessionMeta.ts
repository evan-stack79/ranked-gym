import type { AppDisciplineId } from '../data/disciplines'
import type {
  EnduranceSessionDetails,
  SessionKind,
  SessionSource,
  TeamSessionDetails,
  TeamSessionType,
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

export type TeamSheetFields = {
  sessionType: TeamSessionType
  minutesPlayed: number | null
  position: string
}

/** État initial / reset de la sheet team. */
export function emptyTeamSheetFields(): TeamSheetFields {
  return {
    sessionType: 'training',
    minutesPlayed: null,
    position: '',
  }
}

/**
 * Construit des détails team valides.
 * - position : trim ; vide → omis
 * - minutesPlayed : facultatif ; si présent → fini, > 0 et ≤ durationMin
 * Retourne null si minutes invalides.
 */
export function buildTeamDetails(input: {
  sessionType: TeamSessionType
  durationMin: number
  minutesPlayed?: number | null
  position?: string | null
}): TeamSessionDetails | null {
  const positionRaw = input.position?.trim() ?? ''
  const position = positionRaw.length > 0 ? positionRaw : undefined

  let minutesPlayed: number | undefined
  if (input.minutesPlayed != null) {
    const m = input.minutesPlayed
    if (
      !(
        Number.isFinite(m) &&
        m > 0 &&
        Number.isFinite(input.durationMin) &&
        m <= input.durationMin
      )
    ) {
      return null
    }
    minutesPlayed = m
  }

  return {
    kind: 'team',
    sessionType: input.sessionType,
    ...(minutesPlayed != null ? { minutesPlayed } : {}),
    ...(position != null ? { position } : {}),
  }
}
