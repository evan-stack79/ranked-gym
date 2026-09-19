import { getSportById } from '../data/sports'
import type {
  SessionKind,
  TrainingState,
  Weekday,
  WorkoutNote,
  WorkoutRoutine,
} from '../types/training'
import { todayKey } from './calories'
import { getTodayWorkout } from './todayWorkout'
import { paceSecPerKmFromDuration, sessionKindForSport } from './sessionMeta'
import { getLocalWeekBounds, isTimestampInLocalWeek, workoutValidationMs } from './weekBounds'
import { dedupeWorkoutNotes, noteDurationMin } from './workoutHistory'

/** Priorité CTA carte Aujourd’hui. */
export type TrainCtaKind = 'resume' | 'start' | 'open_train' | 'choose_activity'

/** Cible de navigation — indépendante du sport global courant. */
export type TrainOpenTarget = 'notebook' | 'endurance' | 'session' | 'activity'

export type SportSummaryFilter = 'all' | 'strength' | 'endurance' | 'team' | 'other'

export type ActiveStrengthSession = {
  routineId: string
  title: string
  exerciseCount: number
  doneSetCount: number
}

export type TodayHubCard = {
  cta: TrainCtaKind
  /** Nom de la séance ou du sport. */
  title: string
  /** Type de sport (libellé court). */
  sportLabel: string
  /** Une seule ligne de résumé — null si rien d’utile. */
  summaryLine: string | null
  /** Routine démarrable / à reprendre uniquement. */
  routineId: string | null
  canLaunchRoutine: boolean
  /**
   * Navigation CTA — ne dépend pas de `primarySportId` / discipline globale.
   * `notebook` = carnet force ; `activity` = sheet multisport.
   */
  openTarget: TrainOpenTarget
  /** Sport à activer avant d'ouvrir le parcours planifié. */
  sportId: string | null
  sessionKind: SessionKind | null
}

export type WeekDayCell = {
  dateKey: string
  weekday: Weekday
  shortLabel: string
  dayNumber: number
  isToday: boolean
  hasSession: boolean
  /** Libellé date locale complet pour accessibilité. */
  accessibleLabel: string
}

export type WeeklyMetric = {
  id: string
  label: string
  /** Affichage prêt UI — jamais « NaN » / « undefined ». */
  display: string
  /** Valeur numérique sous-jacente si pertinente (tests). */
  value: number | null
}

export type WeeklySummary = {
  filter: SportSummaryFilter
  metrics: [WeeklyMetric, WeeklyMetric]
  sessionCount: number
}

export type RecentSessionItem = {
  id: string
  title: string
  sportLabel: string
  dateLabel: string
  summary: string
  note: WorkoutNote
}

const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const
const WEEKDAY_LONG = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Compte les séries marquées done sur une routine (séance en cours). */
export function countDoneSets(routine: WorkoutRoutine): number {
  let n = 0
  for (const ex of routine.exercises ?? []) {
    for (const set of ex.sets ?? []) {
      if (set.done === true) n += 1
    }
  }
  return n
}

/** Séance musculation déjà commencée = marqueur actif explicite et routine encore valide. */
export function findActiveStrengthSession(state: TrainingState): ActiveStrengthSession | null {
  const active = state.activeWorkoutDraft
  if (!active || sessionKindForSport(active.sportId) !== 'strength') return null
  const routine = state.routines.find((candidate) => candidate.id === active.routineId)
  if (!routine) return null
  return {
    routineId: routine.id,
    title: routine.label?.trim() || 'Séance',
    exerciseCount: routine.exercises?.length ?? 0,
    doneSetCount: countDoneSets(routine),
  }
}

export function sportLabelForNote(note: WorkoutNote): string {
  if (note.sportId) {
    const sport = getSportById(note.sportId)
    if (sport?.name) return sport.name
  }
  switch (note.sessionKind) {
    case 'strength':
      return 'Musculation'
    case 'endurance':
      return 'Course / Endurance'
    case 'team':
      return 'Football / Sport collectif'
    case 'generic':
      return note.title?.trim() || 'Autre sport'
    default:
      return note.title?.trim() || 'Séance'
  }
}

export function resolveSessionKind(note: WorkoutNote): SessionKind {
  if (note.sessionKind) return note.sessionKind
  if (note.details?.kind === 'endurance') return 'endurance'
  if (note.details?.kind === 'team') return 'team'
  if (note.sportId && getSportById(note.sportId)) return trainSessionKindForSport(note.sportId)
  const hasLift = note.exercises?.some((e) => e.sets?.some((s) => (s.weightKg ?? 0) > 0))
  if (hasLift) return 'strength'
  return 'generic'
}

/** Choix du formulaire Train depuis le catalogue, sans changer les disciplines partagées. */
export function trainSessionKindForSport(sportId: string): SessionKind {
  return sessionKindForSport(sportId)
}

/** Allure mm:ss — arrondit d’abord les secondes totales (jamais :60). */
export function formatPaceDisplay(paceSec: number): string {
  const totalSec = Math.round(paceSec)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function formatDistanceKm(km: number): string {
  const rounded = Math.round(km * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded)
  return `${text.replace('.', ',')} km`
}

/**
 * Durée active pour résumés hub.
 * Force : durée réelle ou estimation existante.
 * Match football : `minutesPlayed` valide prioritaire, sinon `durationMin` (fallback documenté).
 * Non-force : uniquement durée réelle — jamais de durée fictive.
 */
export function hubActiveMinutes(note: WorkoutNote): number {
  if (note.details?.kind === 'team' && note.details.sessionType === 'match') {
    const played = note.details.minutesPlayed
    if (isFinitePositive(played)) return played
  }
  if (note.durationMin != null && isFinitePositive(note.durationMin)) {
    return note.durationMin
  }
  const kind = resolveSessionKind(note)
  if (kind === 'strength') {
    const estimated = noteDurationMin(note)
    return isFinitePositive(estimated) ? estimated : 0
  }
  return 0
}

/**
 * Résumé court d’une séance — jamais NaN / 0 km fictif / allure inventée.
 */
export function formatSessionSummary(note: WorkoutNote): string {
  const kind = resolveSessionKind(note)
  const duration = note.durationMin != null && isFinitePositive(note.durationMin)
    ? Math.round(note.durationMin)
    : null

  if (kind === 'strength') {
    const exercises = note.exercises?.filter((e) => e.sets?.length > 0) ?? []
    const sets = exercises.reduce((acc, e) => acc + (e.sets?.length ?? 0), 0)
    const parts: string[] = []
    if (exercises.length > 0) {
      parts.push(`${exercises.length} exo${exercises.length > 1 ? 's' : ''}`)
    }
    if (sets > 0) parts.push(`${sets} série${sets > 1 ? 's' : ''}`)
    if (duration != null) parts.push(`${duration} min`)
    return parts.join(' · ') || 'Séance force'
  }

  if (kind === 'endurance') {
    const distance =
      note.details?.kind === 'endurance' && isFinitePositive(note.details.distanceKm)
        ? note.details.distanceKm
        : null
    const parts: string[] = []
    if (duration != null) parts.push(`${duration} min`)
    if (distance != null) parts.push(formatDistanceKm(distance))
    if (duration != null && distance != null) {
      const pace = paceSecPerKmFromDuration(duration, distance)
      if (pace != null) parts.push(formatPaceDisplay(pace))
    }
    return parts.join(' · ') || 'Sortie'
  }

  if (kind === 'team') {
    const team = note.details?.kind === 'team' ? note.details : null
    const typeLabel =
      team?.sessionType === 'match'
        ? 'Match'
        : team?.sessionType === 'training'
          ? 'Entraînement'
          : 'Séance'
    // Match : minutesPlayed valide prioritaire ; sinon durationMin (fallback).
    const teamMin =
      team?.sessionType === 'match' && isFinitePositive(team.minutesPlayed)
        ? Math.round(team.minutesPlayed)
        : duration
    const parts: string[] = [typeLabel]
    if (teamMin != null) parts.push(`${teamMin} min`)
    // Poste uniquement dans le détail — pas sur la ligne résumé hub.
    return parts.join(' · ')
  }

  // Autre / generic
  const parts: string[] = []
  const name = note.title?.trim()
  if (name) parts.push(name)
  if (duration != null) parts.push(`${duration} min`)
  // Ne jamais dériver l’effort du difficulty='ok' technique auto-injecté à la saisie.
  // Afficher seulement un effort explicitement saisi (easy / hard).
  const effort = note.exercises?.[0]?.sets?.[0]?.difficulty
  if (effort === 'easy') parts.push('Effort facile')
  else if (effort === 'hard') parts.push('Effort dur')
  if (parts.length === 0) return 'Séance'
  const unique: string[] = []
  for (const p of parts) {
    if (!unique.includes(p)) unique.push(p)
  }
  return unique.join(' · ')
}

/**
 * Carte Aujourd’hui — ordre de priorité strict.
 * Ne propose jamais de lancer une routine invalide (canLaunchRoutine = false).
 * Ne dépend pas du sport global courant pour le libellé / la cible CTA.
 *
 * Fallback créneaux legacy sans sportId :
 * - template force connu ou routine carnet démarrable → Musculation ;
 * - sinon → « Séance planifiée » + sheet activité (source non ambiguë absente).
 */
export function deriveTodayHubCard(
  state: TrainingState,
  now = new Date(),
): TodayHubCard {
  const active = findActiveStrengthSession(state)
  if (active) {
    const summaryParts: string[] = []
    if (active.exerciseCount > 0) {
      summaryParts.push(
        `${active.exerciseCount} exo${active.exerciseCount > 1 ? 's' : ''}`,
      )
    }
    if (active.doneSetCount > 0) {
      summaryParts.push(
        `${active.doneSetCount} série${active.doneSetCount > 1 ? 's' : ''} faite${active.doneSetCount > 1 ? 's' : ''}`,
      )
    } else {
      summaryParts.push('Séance en cours')
    }
    return {
      cta: 'resume',
      title: active.title,
      sportLabel: 'Musculation',
      summaryLine: summaryParts.join(' · '),
      routineId: active.routineId,
      canLaunchRoutine: true,
      openTarget: 'notebook',
      sportId: state.activeWorkoutDraft?.sportId ?? 'musculation',
      sessionKind: 'strength',
    }
  }

  const planned = getTodayWorkout(state, now)
  if (planned?.canStart) {
    const plannedSport = planned.sportId ? getSportById(planned.sportId) : undefined
    const sportLabel = planned.sessionKind === 'strength'
        ? 'Musculation'
        : plannedSport?.name ?? (planned.sessionKind === 'endurance'
          ? 'Course / Endurance'
          : planned.sessionKind === 'team'
            ? 'Football / Sport collectif'
            : planned.title)
    return {
      cta: 'start',
      title: planned.title,
      sportLabel,
      summaryLine:
        planned.sessionKind === 'strength' && planned.exerciseCount > 0
          ? `${planned.exerciseCount} exercice${planned.exerciseCount > 1 ? 's' : ''}`
          : planned.time
            ? `Prévue à ${planned.time}`
            : null,
      routineId: planned.sessionKind === 'strength' ? planned.routineId : null,
      canLaunchRoutine: planned.sessionKind === 'strength',
      openTarget:
        planned.sessionKind === 'strength'
          ? 'notebook'
          : planned.sessionKind === 'endurance'
            ? 'endurance'
            : 'session',
      sportId: planned.sportId,
      sessionKind: planned.sessionKind,
    }
  }

  if (planned && !planned.canStart) {
    if (planned.isStrengthTemplate) {
      return {
        cta: 'open_train',
        title: planned.title,
        sportLabel: 'Musculation',
        summaryLine: 'Routine indisponible',
        routineId: null,
        canLaunchRoutine: false,
        openTarget: 'notebook',
        sportId: planned.sportId,
        sessionKind: planned.sessionKind,
      }
    }
    // Créneau legacy / notebook sans sportId — pas d’invention de type sportif.
    return {
      cta: 'open_train',
      title: planned.title,
      sportLabel: 'Séance planifiée',
      summaryLine: 'Choisir le parcours',
      routineId: null,
      canLaunchRoutine: false,
      openTarget: 'activity',
      sportId: planned.sportId,
      sessionKind: planned.sessionKind,
    }
  }

  return {
    cta: 'choose_activity',
    title: 'Aucune séance',
    sportLabel: 'Multisport',
    summaryLine: 'Choisis une activité pour commencer',
    routineId: null,
    canLaunchRoutine: false,
    openTarget: 'activity',
    sportId: null,
    sessionKind: null,
  }
}

/** Identifiant de routine transmissible à un démarrage — jamais si invalide. */
export function launchableRoutineId(card: TodayHubCard): string | null {
  if (!card.canLaunchRoutine) return null
  if (card.cta !== 'resume' && card.cta !== 'start') return null
  return card.routineId
}

function buildAccessibleDayLabel(
  date: Date,
  weekday: Weekday,
  isToday: boolean,
  hasSession: boolean,
): string {
  const dateText = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const parts = [dateText]
  if (isToday) parts.push('aujourd’hui')
  if (hasSession) parts.push('séance enregistrée')
  else parts.push('aucune séance')
  // Garantir un libellé même si toLocaleDateString est minimal.
  if (!dateText) {
    return `${WEEKDAY_LONG[weekday]} ${date.getDate()}${isToday ? ', aujourd’hui' : ''}`
  }
  return parts.join(', ')
}

/**
 * Bande de 7 jours (lun → dim) de la semaine locale courante.
 * `hasSession` uniquement si une vraie note enregistrée existe ce jour-là.
 */
export function deriveWeekStrip(
  notes: WorkoutNote[],
  now = new Date(),
): WeekDayCell[] {
  const { start } = getLocalWeekBounds(now)
  const today = todayKey(now)
  const clean = dedupeWorkoutNotes(notes)
  const daysWithSession = new Set(clean.map((n) => n.dateKey))

  const cells: WeekDayCell[] = []
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateKey = todayKey(d)
    const weekday = d.getDay() as Weekday
    const isToday = dateKey === today
    const hasSession = daysWithSession.has(dateKey)
    cells.push({
      dateKey,
      weekday,
      shortLabel: WEEKDAY_SHORT[weekday],
      dayNumber: d.getDate(),
      isToday,
      hasSession,
      accessibleLabel: buildAccessibleDayLabel(d, weekday, isToday, hasSession),
    })
  }
  return cells
}

function notesInLocalWeek(notes: WorkoutNote[], now: Date): WorkoutNote[] {
  return dedupeWorkoutNotes(notes).filter((note) => {
    const ms = workoutValidationMs({
      createdAt: note.createdAt,
      dateKey: note.dateKey,
    })
    return ms != null && isTimestampInLocalWeek(ms, now)
  })
}

function matchesFilter(note: WorkoutNote, filter: SportSummaryFilter): boolean {
  if (filter === 'all') return true
  const kind = resolveSessionKind(note)
  if (filter === 'other') return kind === 'generic'
  return kind === filter
}

function metric(id: string, label: string, value: number | null, display: string): WeeklyMetric {
  return { id, label, value, display }
}

/**
 * Résumé hebdo — 2 métriques universelles, ou spécifiques si filtre sport.
 * Aucune addition d’unités incompatibles.
 */
export function deriveWeeklySummary(
  notes: WorkoutNote[],
  filter: SportSummaryFilter = 'all',
  now = new Date(),
): WeeklySummary {
  const weekNotes = notesInLocalWeek(notes, now).filter((n) => matchesFilter(n, filter))
  const sessionCount = weekNotes.length
  const totalActiveMin = weekNotes.reduce((acc, n) => acc + hubActiveMinutes(n), 0)

  if (filter === 'all') {
    return {
      filter,
      sessionCount,
      metrics: [
        metric('sessions', 'Séances', sessionCount, String(sessionCount)),
        metric(
          'active_min',
          'Temps actif',
          totalActiveMin,
          totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '0 min',
        ),
      ],
    }
  }

  if (filter === 'strength') {
    let exercises = 0
    let sets = 0
    for (const n of weekNotes) {
      for (const ex of n.exercises ?? []) {
        if ((ex.sets?.length ?? 0) > 0) {
          exercises += 1
          sets += ex.sets.length
        }
      }
    }
    return {
      filter,
      sessionCount,
      metrics: [
        metric(
          'ex_sets',
          'Exos / séries',
          sets,
          `${exercises}/${sets}`,
        ),
        metric(
          'duration',
          'Durée',
          totalActiveMin,
          totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '—',
        ),
      ],
    }
  }

  if (filter === 'endurance') {
    let distance = 0
    let distanceCount = 0
    let paceDurationMin = 0
    let paceDistanceKm = 0
    for (const n of weekNotes) {
      const dist =
        n.details?.kind === 'endurance' && isFinitePositive(n.details.distanceKm)
          ? n.details.distanceKm
          : null
      const dur =
        n.durationMin != null && isFinitePositive(n.durationMin) ? n.durationMin : null
      if (dist != null) {
        distance += dist
        distanceCount += 1
        if (dur != null) {
          paceDurationMin += dur
          paceDistanceKm += dist
        }
      }
    }
    // Allure agrégée = durée totale / distance totale (pas moyenne des allures).
    const aggPace =
      paceDistanceKm > 0 && paceDurationMin > 0
        ? paceSecPerKmFromDuration(paceDurationMin, paceDistanceKm)
        : null

    if (distanceCount > 0) {
      return {
        filter,
        sessionCount,
        metrics: [
          metric('distance', 'Distance', distance, formatDistanceKm(distance)),
          aggPace != null
            ? metric('pace', 'Allure moy.', aggPace, formatPaceDisplay(aggPace))
            : metric(
                'duration',
                'Durée',
                totalActiveMin,
                totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '—',
              ),
        ],
      }
    }

    return {
      filter,
      sessionCount,
      metrics: [
        metric('sessions', 'Séances', sessionCount, String(sessionCount)),
        metric(
          'duration',
          'Durée',
          totalActiveMin,
          totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '—',
        ),
      ],
    }
  }

  if (filter === 'team') {
    const matchCount = weekNotes.filter(
      (n) => n.details?.kind === 'team' && n.details.sessionType === 'match',
    ).length
    const trainingCount = weekNotes.filter(
      (n) => n.details?.kind === 'team' && n.details.sessionType === 'training',
    ).length
    const unknownCount = weekNotes.length - matchCount - trainingCount
    const chunks: string[] = []
    if (trainingCount > 0) {
      chunks.push(`${trainingCount} ent.`)
    }
    if (matchCount > 0) {
      chunks.push(`${matchCount} match${matchCount > 1 ? 's' : ''}`)
    }
    if (unknownCount > 0) {
      chunks.push(`${unknownCount} séance${unknownCount > 1 ? 's' : ''}`)
    }
    const typeLabel = chunks.length > 0 ? chunks.join(' / ') : '0 séance'

    return {
      filter,
      sessionCount,
      metrics: [
        metric('team_count', 'Matchs / ent.', weekNotes.length, typeLabel),
        metric(
          'minutes',
          'Minutes',
          totalActiveMin,
          totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '0 min',
        ),
      ],
    }
  }

  // other
  return {
    filter,
    sessionCount,
    metrics: [
      metric('sessions', 'Séances', sessionCount, String(sessionCount)),
      metric(
        'duration',
        'Durée',
        totalActiveMin,
        totalActiveMin > 0 ? `${Math.round(totalActiveMin)} min` : '0 min',
      ),
    ],
  }
}

function formatRecentDateLabel(dateKey: string, now: Date): string {
  const today = todayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === today) return 'Aujourd’hui'
  if (dateKey === todayKey(yesterday)) return 'Hier'
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Maximum `limit` dernières séances (dédupe), résumé multisport. */
export function deriveRecentSessions(
  notes: WorkoutNote[],
  now = new Date(),
  limit = 2,
): RecentSessionItem[] {
  const clean = dedupeWorkoutNotes(notes)
  return clean.slice(0, Math.max(0, limit)).map((note) => ({
    id: note.id,
    title: note.title?.trim() || 'Séance',
    sportLabel: sportLabelForNote(note),
    dateLabel: formatRecentDateLabel(note.dateKey, now),
    summary: formatSessionSummary(note),
    note,
  }))
}

export const TRAIN_CTA_LABELS: Record<TrainCtaKind, string> = {
  resume: 'Reprendre',
  start: 'Démarrer',
  open_train: 'Ouvrir Train',
  choose_activity: 'Choisir une activité',
}
