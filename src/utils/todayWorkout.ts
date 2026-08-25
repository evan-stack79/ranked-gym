import type { ScheduledSession, TrainingState, Weekday } from '../types/training'

export interface TodayWorkoutPlan {
  routineId: string
  title: string
  subtitle: string
  accent: string
  source: 'schedule'
  exerciseCount: number
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

function resolveRoutineId(templateId: string): string {
  return TEMPLATE_TO_ROUTINE[templateId] ?? templateId
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
  return {
    routineId,
    title: scheduled.title,
    subtitle: routine?.subtitle ?? 'Programme du jour',
    accent: routine?.accent ?? '#FF2B2B',
    source: 'schedule',
    exerciseCount: routine?.exercises.length ?? 0,
  }
}
