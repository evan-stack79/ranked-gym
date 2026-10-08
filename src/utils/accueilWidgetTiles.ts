/**
 * Pure data helpers for Accueil coloured metric tiles.
 * Uses only existing training / nutrition storage — never invents kcal/weight.
 */

import type { TrainingState, Weekday, WorkoutNote } from '../types/training'
import { getTodayWaterMl } from '../services/nutritionStorage'
import { todayKey } from './calories'
import {
  countTotalSets,
  computeProgramProgressPercent,
} from './accueilGallery'
import {
  hasUserWaterGoal,
  normalizeWaterGoalMl,
  type AccueilWidgetPrefs,
} from './accueilWidgetPrefs'
import {
  countDoneSets,
  deriveWeekStrip,
  findActiveStrengthSession,
  type WeekDayCell,
} from './trainHub'
import { getTodayWorkout } from './todayWorkout'
import { formatWaterMl } from './waterGoal'
import { getLocalWeekBounds, isTimestampInLocalWeek, workoutValidationMs } from './weekBounds'
import { dedupeWorkoutNotes } from './workoutHistory'
import { detectProgramSplit, filterRoutinesForProgram } from './workoutProgram'

const WEEKDAY_SHORT_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const

export type WeekSessionBar = {
  dateKey: string
  shortLabel: string
  count: number
  isToday: boolean
  /** 0–1 relative to max count in the week (0 when empty). */
  heightRatio: number
}

function countSetsInNote(note: WorkoutNote): number {
  let n = 0
  for (const ex of note.exercises ?? []) {
    n += ex.sets?.length ?? 0
  }
  return n
}

/** Logged sessions per day of the current local week (Mon→Sun). */
export function deriveWeekSessionBars(
  state: TrainingState,
  now = new Date(),
): WeekSessionBar[] {
  const strip: WeekDayCell[] = deriveWeekStrip(state.workoutNotes ?? [], now)
  const notes = dedupeWorkoutNotes(state.workoutNotes ?? [])
  const counts = new Map<string, number>()
  for (const note of notes) {
    if (!note.dateKey) continue
    counts.set(note.dateKey, (counts.get(note.dateKey) ?? 0) + 1)
  }

  const bars = strip.map((cell) => ({
    dateKey: cell.dateKey,
    shortLabel: WEEKDAY_SHORT_FR[cell.weekday] ?? cell.shortLabel,
    count: counts.get(cell.dateKey) ?? 0,
    isToday: cell.isToday,
    heightRatio: 0,
  }))
  const max = Math.max(0, ...bars.map((b) => b.count))
  return bars.map((b) => ({
    ...b,
    heightRatio: max > 0 && b.count > 0 ? b.count / max : 0,
  }))
}

export type WaterTileModel = {
  waterMl: number
  /** User-chosen goal only — never weight-based auto goal. */
  goalMl: number | null
  showRing: boolean
  progress: number
}

/**
 * Eau tile model. Ring ONLY when prefs carry an explicit user goal.
 * Never calls calculateDailyWaterGoal / getDailyWaterGoalMl.
 */
export function deriveWaterTileModel(
  prefs: AccueilWidgetPrefs,
  waterMl: number = getTodayWaterMl(),
): WaterTileModel {
  const goalMl = hasUserWaterGoal(prefs) ? normalizeWaterGoalMl(prefs.waterGoalMl) : null
  const showRing = goalMl != null && goalMl > 0
  const safeMl = Number.isFinite(waterMl) ? Math.max(0, Math.round(waterMl)) : 0
  return {
    waterMl: safeMl,
    goalMl,
    showRing,
    progress: showRing && goalMl! > 0 ? Math.min(1, Math.max(0, safeMl / goalMl!)) : 0,
  }
}

export type SetsTileModel = {
  doneSets: number
  /** Planned sets in today's session — null when no planned session (no ring). */
  plannedSets: number | null
  showRing: boolean
  progress: number
}

/**
 * Séries du jour — count from the logged/active session.
 * Ring goal = planned sets in today's session only.
 */
export function deriveSetsTileModel(
  state: TrainingState,
  now = new Date(),
): SetsTileModel {
  const active = findActiveStrengthSession(state)
  const todayPlan = getTodayWorkout(state, now)
  const key = todayKey(now)

  let doneSets = 0
  let plannedSets: number | null = null

  if (active) {
    doneSets = active.doneSetCount
    const routine = state.routines.find((r) => r.id === active.routineId)
    plannedSets = routine ? countTotalSets(routine) : null
  } else {
    const todayNotes = dedupeWorkoutNotes(state.workoutNotes ?? []).filter(
      (n) => n.dateKey === key,
    )
    doneSets = todayNotes.reduce((sum, n) => sum + countSetsInNote(n), 0)

    if (todayPlan) {
      const routine = state.routines.find((r) => r.id === todayPlan.routineId)
      if (routine) {
        plannedSets = countTotalSets(routine)
        if (doneSets === 0) {
          doneSets = countDoneSets(routine)
        }
      }
    }
  }

  if (plannedSets != null && plannedSets <= 0) plannedSets = null

  const showRing = plannedSets != null && plannedSets > 0
  return {
    doneSets: Math.max(0, doneSets),
    plannedSets,
    showRing,
    progress: showRing ? Math.min(1, Math.max(0, doneSets / plannedSets!)) : 0,
  }
}

export type NextSessionTileModel = {
  title: string
  subtitle: string
  routineId: string | null
  canStart: boolean
  /** True when an active strength session is already in progress → CTA « Reprendre ». */
  inProgress: boolean
  /** ISO-ish date key of the planned day (today or future). */
  dateKey: string | null
}

function resolveRoutineIdFromTemplate(templateId: string): string {
  const map: Record<string, string> = {
    'tpl-upper': 'upper',
    'tpl-lower': 'lower',
    'tpl-push': 'push',
    'tpl-pull': 'pull',
    'tpl-legs': 'legs',
    'tpl-full': 'full',
    upper: 'upper',
    lower: 'lower',
    push: 'push',
    pull: 'pull',
    legs: 'legs',
    full: 'full',
    full_body: 'full',
    pecs: 'pecs',
  }
  return map[templateId] ?? templateId
}

/**
 * Prochaine séance — today's planned workout, or the next enabled schedule slot.
 * Démarrer uses the same routineId path as the rest of Accueil.
 */
export function deriveNextSessionTile(
  state: TrainingState,
  now = new Date(),
): NextSessionTileModel {
  const active = findActiveStrengthSession(state)
  if (active) {
    return {
      title: active.title,
      subtitle: 'Séance en cours',
      routineId: active.routineId,
      canStart: true,
      inProgress: true,
      dateKey: todayKey(now),
    }
  }

  const today = getTodayWorkout(state, now)
  if (today) {
    return {
      title: today.title,
      subtitle: today.canStart
        ? `${today.exerciseCount} exercice${today.exerciseCount > 1 ? 's' : ''} · ${today.time}`
        : `Planifiée · ${today.time}`,
      routineId: today.routineId,
      canStart: today.canStart,
      inProgress: false,
      dateKey: todayKey(now),
    }
  }

  const schedule = (state.schedule ?? []).filter((s) => s.enabled)
  for (let offset = 1; offset <= 14; offset += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const weekday = d.getDay() as Weekday
    const slots = schedule
      .filter((s) => s.days.includes(weekday))
      .sort((a, b) => a.time.localeCompare(b.time))
    const slot = slots[0]
    if (!slot) continue
    const routineId = resolveRoutineIdFromTemplate(slot.templateId)
    const routine = state.routines.find((r) => r.id === routineId)
    const canStart = Boolean(routine && (routine.exercises?.length ?? 0) > 0)
    const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    return {
      title: slot.title || routine?.label || 'Séance',
      subtitle: `${dayLabel} · ${slot.time}`,
      routineId,
      canStart,
      inProgress: false,
      dateKey: todayKey(d),
    }
  }

  return {
    title: 'Aucune séance prévue',
    subtitle: 'Planifie dans Train',
    routineId: null,
    canStart: false,
    inProgress: false,
    dateKey: null,
  }
}

export type ProgramTileModel = {
  percent: number
  /** Useful secondary line — not a repeat of the big %. */
  label: string
  doneSessions: number
  plannedSessions: number
}

/**
 * Programme tile — % from existing helper.
 * Subtitle counts **planned program** sessions (agenda), not all logged sessions
 * (those appear on « Séances de la semaine »). Wording makes that distinction clear.
 */
export function deriveProgramTileModel(
  state: TrainingState,
  now = new Date(),
): ProgramTileModel {
  const percent = computeProgramProgressPercent(state, now)
  const { start, end } = getLocalWeekBounds(now)
  const schedule = (state.schedule ?? []).filter((s) => s.enabled)

  let plannedSessions = 0
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const weekday = new Date(t).getDay() as Weekday
    for (const slot of schedule) {
      if (slot.days.includes(weekday)) plannedSessions += 1
    }
  }

  if (plannedSessions > 0) {
    const notes = dedupeWorkoutNotes(state.workoutNotes)
    const doneSessions = notes.filter((note) => {
      const ms = workoutValidationMs(note)
      return ms != null && isTimestampInLocalWeek(ms, now)
    }).length
    const capped = Math.min(doneSessions, plannedSessions)
    return {
      percent,
      doneSessions: capped,
      plannedSessions,
      label: `${capped} / ${plannedSessions} séance${plannedSessions > 1 ? 's' : ''} du programme`,
    }
  }

  const split = detectProgramSplit(state.schedule ?? [], state.routines)
  const programRoutines = filterRoutinesForProgram(state.routines, split)
  if (programRoutines.length === 0) {
    return {
      percent,
      doneSessions: 0,
      plannedSessions: 0,
      label: 'Pas encore de progression',
    }
  }
  const ready = programRoutines.filter((r) => (r.exercises?.length ?? 0) > 0).length
  return {
    percent,
    doneSessions: ready,
    plannedSessions: programRoutines.length,
    label: `${ready} / ${programRoutines.length} routine${programRoutines.length > 1 ? 's' : ''} prête${ready > 1 ? 's' : ''}`,
  }
}

/** Compact goal line for the Eau tile — stays on one line at 402px. */
export function formatWaterGoalHint(goalMl: number): string {
  return `sur ${formatWaterMl(goalMl)}`
}

export type WaterTileRingDecision = {
  showRing: boolean
  goalMl: number | null
}

/** Test helper — ring decision from prefs alone (no storage). */
export function waterRingFromPrefs(prefs: AccueilWidgetPrefs): WaterTileRingDecision {
  const model = deriveWaterTileModel(prefs, 0)
  return { showRing: model.showRing, goalMl: model.goalMl }
}
