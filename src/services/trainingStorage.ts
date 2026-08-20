import type {
  CompletedSession,
  ScheduledSession,
  SessionTemplate,
  TrainingState,
  WorkoutNote,
} from '../types/training'
import { todayKey } from '../utils/calories'

const KEY = 'ranked-gym:training'

export const DEFAULT_TEMPLATES: SessionTemplate[] = [
  {
    id: 'tpl-upper',
    kind: 'upper',
    title: 'Upper',
    subtitle: 'Haut du corps',
    muscles: ['Pectoraux', 'Dos', 'Épaules', 'Bras'],
    accent: '#FF2B2B',
  },
  {
    id: 'tpl-lower',
    kind: 'lower',
    title: 'Lower',
    subtitle: 'Bas du corps',
    muscles: ['Quadriceps', 'Ischios', 'Fessiers', 'Mollets'],
    accent: '#00B4FF',
  },
  {
    id: 'tpl-push',
    kind: 'push',
    title: 'Push',
    subtitle: 'Poussée',
    muscles: ['Pectoraux', 'Épaules', 'Triceps'],
    accent: '#FF9F0A',
  },
  {
    id: 'tpl-pull',
    kind: 'pull',
    title: 'Pull',
    subtitle: 'Tirage',
    muscles: ['Dos', 'Biceps', 'Arrière d’épaule'],
    accent: '#BF5AF2',
  },
  {
    id: 'tpl-legs',
    kind: 'legs',
    title: 'Legs',
    subtitle: 'Jambes complètes',
    muscles: ['Quads', 'Ischios', 'Fessiers'],
    accent: '#30D158',
  },
  {
    id: 'tpl-full',
    kind: 'full_body',
    title: 'Full body',
    subtitle: 'Corps entier',
    muscles: ['Tout le corps'],
    accent: '#64D2FF',
  },
]

const DEFAULT_STATE: TrainingState = {
  primarySportId: null,
  favoriteSportIds: [],
  stepsToday: 0,
  stepsDateKey: todayKey(),
  healthLinked: false,
  notificationsEnabled: false,
  templates: DEFAULT_TEMPLATES,
  schedule: [],
  completed: [],
  workoutNotes: [],
}

function read(): TrainingState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STATE, templates: [...DEFAULT_TEMPLATES] }
    const parsed = JSON.parse(raw) as Partial<TrainingState>
    const merged: TrainingState = {
      ...DEFAULT_STATE,
      ...parsed,
      templates:
        parsed.templates && parsed.templates.length > 0
          ? parsed.templates
          : [...DEFAULT_TEMPLATES],
      schedule: parsed.schedule ?? [],
      completed: parsed.completed ?? [],
      favoriteSportIds: parsed.favoriteSportIds ?? [],
      workoutNotes: parsed.workoutNotes ?? [],
      notificationsEnabled: Boolean(parsed.notificationsEnabled),
    }
    if (merged.stepsDateKey !== todayKey()) {
      merged.stepsToday = 0
      merged.stepsDateKey = todayKey()
    }
    return merged
  } catch {
    return { ...DEFAULT_STATE, templates: [...DEFAULT_TEMPLATES] }
  }
}

function write(state: TrainingState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function getTrainingState(): TrainingState {
  return read()
}

export function saveTrainingState(state: TrainingState): void {
  write(state)
}

export function setPrimarySport(sportId: string): TrainingState {
  const state = read()
  const favorites = state.favoriteSportIds.includes(sportId)
    ? state.favoriteSportIds
    : [sportId, ...state.favoriteSportIds].slice(0, 8)
  const next = { ...state, primarySportId: sportId, favoriteSportIds: favorites }
  write(next)
  return next
}

export function setStepsToday(steps: number): TrainingState {
  const state = read()
  const next = {
    ...state,
    stepsToday: Math.max(0, Math.round(steps)),
    stepsDateKey: todayKey(),
  }
  write(next)
  return next
}

export function setHealthLinked(linked: boolean): TrainingState {
  const state = read()
  const next = { ...state, healthLinked: linked }
  write(next)
  return next
}

export function setNotificationsEnabled(enabled: boolean): TrainingState {
  const state = read()
  const next = { ...state, notificationsEnabled: enabled }
  write(next)
  return next
}

export function addCustomTemplate(input: {
  title: string
  muscles: string[]
  accent?: string
}): TrainingState {
  const state = read()
  const tpl: SessionTemplate = {
    id: `tpl-custom-${Date.now()}`,
    kind: 'custom',
    title: input.title.trim() || 'Séance custom',
    subtitle: 'Ciblage musculaire',
    muscles: input.muscles.length ? input.muscles : ['Personnalisé'],
    accent: input.accent ?? '#FF2B2B',
  }
  const next = { ...state, templates: [tpl, ...state.templates] }
  write(next)
  return next
}

export function upsertSchedule(
  entry: Omit<ScheduledSession, 'id'> & { id?: string },
): TrainingState {
  const state = read()
  if (entry.id) {
    const next = {
      ...state,
      schedule: state.schedule.map((s) =>
        s.id === entry.id ? { ...s, ...entry, id: entry.id } : s,
      ),
    }
    write(next)
    return next
  }
  const created: ScheduledSession = {
    id: `sch-${Date.now()}`,
    templateId: entry.templateId || 'notebook',
    title: entry.title,
    days: entry.days,
    time: entry.time,
    enabled: entry.enabled,
    remindBeforeMin: entry.remindBeforeMin ?? 10,
  }
  const next = { ...state, schedule: [...state.schedule, created] }
  write(next)
  return next
}

export function removeSchedule(id: string): TrainingState {
  const state = read()
  const next = { ...state, schedule: state.schedule.filter((s) => s.id !== id) }
  write(next)
  return next
}

export function logCompletedSession(input: {
  templateId: string
  title: string
  durationMin: number
  estimatedKcal: number
}): TrainingState {
  const state = read()
  const entry: CompletedSession = {
    id: `done-${Date.now()}`,
    templateId: input.templateId,
    title: input.title,
    dateKey: todayKey(),
    durationMin: input.durationMin,
    estimatedKcal: input.estimatedKcal,
    createdAt: Date.now(),
  }
  const next = { ...state, completed: [entry, ...state.completed].slice(0, 60) }
  write(next)
  return next
}

export function saveWorkoutNote(
  note: Omit<WorkoutNote, 'id' | 'createdAt' | 'dateKey'> & { id?: string },
): TrainingState {
  const state = read()
  const entry: WorkoutNote = {
    id: note.id ?? `note-${Date.now()}`,
    title: note.title,
    exercises: note.exercises,
    estimatedKcal: note.estimatedKcal,
    dateKey: todayKey(),
    createdAt: Date.now(),
  }
  const workoutNotes = [entry, ...state.workoutNotes.filter((n) => n.id !== entry.id)].slice(
    0,
    80,
  )
  const completedEntry: CompletedSession = {
    id: `done-note-${entry.id}`,
    templateId: 'notebook',
    title: entry.title,
    dateKey: entry.dateKey,
    durationMin: Math.max(20, entry.exercises.length * 8),
    estimatedKcal: entry.estimatedKcal,
    createdAt: entry.createdAt,
  }
  const completed = [
    completedEntry,
    ...state.completed.filter((c) => c.id !== completedEntry.id),
  ].slice(0, 60)
  const next = { ...state, workoutNotes, completed }
  write(next)
  return next
}

export function removeWorkoutNote(id: string): TrainingState {
  const state = read()
  const next = {
    ...state,
    workoutNotes: state.workoutNotes.filter((n) => n.id !== id),
    completed: state.completed.filter((c) => c.id !== `done-note-${id}`),
  }
  write(next)
  return next
}

export function todayWorkoutKcal(state: TrainingState = read()): number {
  const key = todayKey()
  return state.completed
    .filter((c) => c.dateKey === key)
    .reduce((sum, c) => sum + c.estimatedKcal, 0)
}
