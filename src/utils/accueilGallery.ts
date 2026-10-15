import type { TrainingState, WorkoutRoutine } from '../types/training'
import { todayKey } from './calories'
import {
  countDoneSets,
  deriveRecentSessions,
  findActiveStrengthSession,
  type RecentSessionItem,
} from './trainHub'
import { getTodayWorkout, type TodayWorkoutPlan } from './todayWorkout'
import { detectProgramSplit, filterRoutinesForProgram } from './workoutProgram'
import { dedupeWorkoutNotes } from './workoutHistory'
import { getLocalWeekBounds, isTimestampInLocalWeek, workoutValidationMs } from './weekBounds'
import { resolvePickerIllustrationSrc } from './exercisePickerIllustrations'
import { namedSessionExercises } from './sessionDisplayTitle'
import type { ExerciseEntry } from '../types/training'

/**
 * Accueil gallery cover: first named exercise with a bundled illustration.
 * Unlike history-row thumbs, multi-exo sessions still get a cover (first hit).
 */
export function resolveGalleryCoverSrc(
  exercises: ExerciseEntry[] | null | undefined,
): string | null {
  for (const ex of namedSessionExercises(exercises)) {
    const src = resolvePickerIllustrationSrc(ex.canonicalExerciseId)
    if (src) return src
  }
  return null
}

/** Compte les séries d’une routine (total planifié). */
export function countTotalSets(routine: WorkoutRoutine): number {
  let n = 0
  for (const ex of routine.exercises ?? []) {
    n += ex.sets?.length ?? 0
  }
  return n
}

/** Clamp 0–100 entier. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Progression séance du jour — uniquement séries faites / planifiées
 * (ou 100 % si une note du jour couvre la routine). Jamais un % corporel.
 */
export function computeSessionProgressPercent(
  state: TrainingState,
  now = new Date(),
): number {
  const active = findActiveStrengthSession(state)
  if (active) {
    const routine = state.routines.find((r) => r.id === active.routineId)
    const total = routine ? countTotalSets(routine) : 0
    if (total <= 0) return 0
    return clampPercent((active.doneSetCount / total) * 100)
  }

  const today = getTodayWorkout(state)
  if (!today) return 0

  const key = todayKey(now)
  const notes = dedupeWorkoutNotes(state.workoutNotes)
  const completed = notes.some(
    (note) =>
      note.dateKey === key &&
      (note.routineId === today.routineId ||
        (note.sessionKind === 'strength' && !note.routineId)),
  )
  if (completed) return 100

  const routine = state.routines.find((r) => r.id === today.routineId)
  if (!routine) return 0
  const total = countTotalSets(routine)
  if (total <= 0) return 0
  const done = countDoneSets(routine)
  return clampPercent((done / total) * 100)
}

/**
 * Progression programme — séances validées cette semaine / occurrences agenda
 * de la semaine (fallback : routines du split avec ≥1 exo / total split).
 * % de progression séance/programme uniquement — jamais un % corporel.
 */
export function computeProgramProgressPercent(
  state: TrainingState,
  now = new Date(),
): number {
  const { start, end } = getLocalWeekBounds(now)
  const schedule = (state.schedule ?? []).filter((s) => s.enabled)

  let plannedOccurrences = 0
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const weekday = new Date(t).getDay() as import('../types/training').Weekday
    for (const slot of schedule) {
      if (slot.days.includes(weekday)) plannedOccurrences += 1
    }
  }

  if (plannedOccurrences > 0) {
    const notes = dedupeWorkoutNotes(state.workoutNotes)
    const doneCount = notes.filter((note) => {
      const ms = workoutValidationMs(note)
      return ms != null && isTimestampInLocalWeek(ms, now)
    }).length
    return clampPercent((Math.min(doneCount, plannedOccurrences) / plannedOccurrences) * 100)
  }

  const split = detectProgramSplit(state.schedule ?? [], state.routines)
  const programRoutines = filterRoutinesForProgram(state.routines, split)
  if (programRoutines.length === 0) return 0
  const ready = programRoutines.filter((r) => (r.exercises?.length ?? 0) > 0).length
  return clampPercent((ready / programRoutines.length) * 100)
}

export type GalleryHeroCard = {
  id: 'session' | 'program'
  title: string
  secondary: string
  progressPercent: number
  accent: 'brand' | 'graphite'
  cta: 'start' | 'open_train' | 'open_notebook'
  routineId: string | null
  /** Optional cover illustration — fills the hero tile when present. */
  imageSrc: string | null
}

export function deriveGalleryHeroCards(
  state: TrainingState,
  now = new Date(),
): GalleryHeroCard[] {
  const today = getTodayWorkout(state)
  const active = findActiveStrengthSession(state)
  const sessionProgress = computeSessionProgressPercent(state, now)

  let sessionSecondary = 'Pas de séance prévue'
  let sessionCta: GalleryHeroCard['cta'] = 'open_train'
  let routineId: string | null = null

  if (active) {
    sessionSecondary = `${active.title} · ${active.doneSetCount} série${active.doneSetCount > 1 ? 's' : ''} faite${active.doneSetCount > 1 ? 's' : ''}`
    sessionCta = 'start'
    routineId = active.routineId
  } else if (today?.canStart) {
    sessionSecondary = `${today.title} · ${today.exerciseCount} exercice${today.exerciseCount > 1 ? 's' : ''}`
    sessionCta = 'start'
    routineId = today.routineId
  } else if (today) {
    sessionSecondary = `${today.title} · Séance planifiée`
    sessionCta = 'open_notebook'
    routineId = today.routineId
  }

  const split = detectProgramSplit(state.schedule ?? [], state.routines)
  const programRoutines = filterRoutinesForProgram(state.routines, split)
  const withExos = programRoutines.filter((r) => (r.exercises?.length ?? 0) > 0).length
  const programSecondary =
    programRoutines.length === 0
      ? 'Configure ton carnet'
      : `${withExos}/${programRoutines.length} routines prêtes`

  const sessionRoutine = routineId
    ? state.routines.find((r) => r.id === routineId)
    : null
  const sessionImageSrc = sessionRoutine
    ? resolveGalleryCoverSrc(sessionRoutine.exercises)
    : null

  return [
    {
      id: 'session',
      title: 'Séance du jour',
      secondary: sessionSecondary,
      progressPercent: sessionProgress,
      accent: 'brand',
      cta: sessionCta,
      routineId,
      imageSrc: sessionImageSrc,
    },
    {
      id: 'program',
      title: 'Mon programme',
      secondary: programSecondary,
      progressPercent: computeProgramProgressPercent(state, now),
      accent: 'graphite',
      cta: 'open_notebook',
      routineId: null,
      imageSrc: null,
    },
  ]
}

export type GalleryProgramTile = {
  id: string
  title: string
  meta: string
  /** Optional cover — fills the tile when present; otherwise dumbbell placeholder. */
  imageSrc: string | null
}

export function deriveGalleryProgramTiles(state: TrainingState): GalleryProgramTile[] {
  const split = detectProgramSplit(state.schedule ?? [], state.routines)
  return filterRoutinesForProgram(state.routines, split)
    .filter((r) => (r.exercises?.length ?? 0) > 0 || r.id.startsWith('custom-'))
    .slice(0, 8)
    .map((r) => {
      const exo = r.exercises?.length ?? 0
      return {
        id: r.id,
        title: r.label,
        meta: exo > 0 ? `${exo} exercice${exo > 1 ? 's' : ''}` : 'À remplir',
        imageSrc: resolveGalleryCoverSrc(r.exercises),
      }
    })
}

export function deriveGalleryRecent(
  state: TrainingState,
  now = new Date(),
  limit = 8,
): RecentSessionItem[] {
  return deriveRecentSessions(state.workoutNotes, now, limit)
}

/** Meta Récent sans calories ni poids — date + résumé exo/séries/durée. */
export function formatGalleryRecentMeta(item: RecentSessionItem): string {
  const parts = [item.dateLabel]
  if (item.summary) parts.push(item.summary)
  return parts.join(' · ')
}

export type { TodayWorkoutPlan }
