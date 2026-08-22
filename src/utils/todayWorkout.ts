import type { ScheduledSession, TrainingState, Weekday } from '../types/training'

export interface TodayWorkoutPlan {
  routineId: string
  title: string
  subtitle: string
  accent: string
  source: 'schedule' | 'rotation'
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

const WEEKLY_ROTATION: Array<{ routineId: string; title: string; subtitle: string }> = [
  { routineId: 'upper', title: 'Séance Upper', subtitle: 'Focus Pectoraux' },
  { routineId: 'lower', title: 'Séance Lower', subtitle: 'Focus Quadriceps' },
  { routineId: 'push', title: 'Séance Push', subtitle: 'Focus Pectoraux' },
  { routineId: 'pull', title: 'Séance Pull', subtitle: 'Focus Dos' },
  { routineId: 'legs', title: 'Séance Jambes', subtitle: 'Focus Fessiers' },
  { routineId: 'full', title: 'Séance Full body', subtitle: 'Corps entier' },
  { routineId: 'upper', title: 'Séance Upper', subtitle: 'Focus Épaules' },
]

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

export function getTodayWorkout(state: TrainingState, now = new Date()): TodayWorkoutPlan {
  const weekday = now.getDay() as Weekday
  const scheduled = pickScheduledToday(state.schedule, weekday)

  if (scheduled) {
    const routineId = resolveRoutineId(scheduled.templateId)
    const routine = state.routines.find((r) => r.id === routineId)
    return {
      routineId,
      title: scheduled.title,
      subtitle: routine?.subtitle ?? 'Programme du jour',
      accent: routine?.accent ?? '#FF2B2B',
      source: 'schedule',
    }
  }

  const rotation = WEEKLY_ROTATION[weekday] ?? WEEKLY_ROTATION[0]
  const routine = state.routines.find((r) => r.id === rotation.routineId)
  return {
    routineId: rotation.routineId,
    title: rotation.title,
    subtitle: rotation.subtitle,
    accent: routine?.accent ?? '#FF2B2B',
    source: 'rotation',
  }
}
