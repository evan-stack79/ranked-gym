import type { ScheduledSession, SessionKind, TrainingState, Weekday } from '../types/training'
import { sessionKindForSport } from './sessionMeta'

export interface TodayWorkoutPlan {
  routineId: string
  title: string
  subtitle: string
  accent: string
  source: 'schedule'
  exerciseCount: number
  /** Routine présente dans le carnet avec au moins un exercice — seul cas « Démarrer ». */
  canStart: boolean
  /** templateId brut du créneau agenda. */
  templateId: string
  /** Métadonnées explicites du créneau, ou fallback force legacy sûr. */
  sportId: string | null
  sessionKind: SessionKind | null
  time: string
  /**
   * Vrai seulement si le template est une entrée force connue du registre existant.
   * Sans `sportId` sur le créneau, c’est la seule source non ambiguë disponible.
   */
  isStrengthTemplate: boolean
}

const TEMPLATE_TO_ROUTINE: Record<string, string> = {
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

/** Templates agenda explicitement mappés vers une routine force (registre existant). */
export function isMappedStrengthTemplate(templateId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_TO_ROUTINE, templateId)
}

function resolveRoutineId(templateId: string): string {
  return TEMPLATE_TO_ROUTINE[templateId] ?? templateId
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Métadonnées de planning fiables : un sport connu fait autorité sur un kind incohérent.
 * Les anciens templates force bénéficient d'un fallback sûr ; un ancien créneau notebook
 * reste volontairement non typé afin de ne jamais inventer de sport.
 */
export function resolveScheduledSessionMeta(
  scheduled: ScheduledSession,
): { sportId: string; sessionKind: SessionKind } | null {
  const explicitSportId = cleanId(scheduled.sportId)
  if (explicitSportId) {
    return {
      sportId: explicitSportId,
      sessionKind: sessionKindForSport(explicitSportId),
    }
  }
  if (isMappedStrengthTemplate(scheduled.templateId)) {
    return { sportId: 'musculation', sessionKind: 'strength' }
  }
  return null
}

function pickScheduledToday(
  schedule: ScheduledSession[],
  weekday: Weekday,
): ScheduledSession | null {
  const todaySessions = schedule.filter((s) => s.enabled && s.days.includes(weekday))
  if (todaySessions.length === 0) return null
  return [...todaySessions].sort((a, b) => a.time.localeCompare(b.time))[0]
}

/**
 * Séance du jour = uniquement ce que l’utilisateur a planifié (agenda).
 * Pas de rotation / suggestion automatique (carnet, pas coach).
 */
export function getTodayWorkout(
  state: TrainingState,
  now = new Date(),
): TodayWorkoutPlan | null {
  const weekday = now.getDay() as Weekday
  const scheduled = pickScheduledToday(state.schedule, weekday)
  if (!scheduled) return null

  const routineId = resolveRoutineId(scheduled.templateId)
  const routine = state.routines.find((r) => r.id === routineId)
  const exerciseCount = routine?.exercises.length ?? 0
  const meta = resolveScheduledSessionMeta(scheduled) ??
    (routine && exerciseCount > 0
      ? { sportId: 'musculation', sessionKind: 'strength' as const }
      : null)
  const isStrengthTemplate = meta?.sessionKind === 'strength'
  const canStart = meta == null
    ? false
    : isStrengthTemplate
      ? Boolean(routine && exerciseCount > 0)
      : true

  return {
    routineId,
    title: scheduled.title,
    subtitle: routine?.subtitle ?? 'Programme du jour',
    accent: routine?.accent ?? '#FF2B2B',
    source: 'schedule',
    exerciseCount,
    canStart,
    templateId: scheduled.templateId,
    isStrengthTemplate,
    sportId: meta?.sportId ?? null,
    sessionKind: meta?.sessionKind ?? null,
    time: scheduled.time,
  }
}
