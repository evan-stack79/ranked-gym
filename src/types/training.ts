export type SportCategory =
  | 'popular'
  | 'strength'
  | 'cardio'
  | 'team'
  | 'racket'
  | 'combat'
  | 'outdoor'
  | 'water'
  | 'other'

export interface Sport {
  id: string
  name: string
  category: SportCategory
  popularity: number
  tracksSteps?: boolean
  kcalPerHour: number
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SessionTemplateKind =
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'full_body'
  | 'custom'

export interface SessionTemplate {
  id: string
  kind: SessionTemplateKind
  title: string
  subtitle: string
  muscles: string[]
  accent: string
}

export interface ScheduledSession {
  id: string
  templateId: string
  title: string
  days: Weekday[]
  time: string
  enabled: boolean
  /** Notify X minutes before */
  remindBeforeMin?: number
}

export interface CompletedSession {
  id: string
  templateId: string
  title: string
  dateKey: string
  durationMin: number
  estimatedKcal: number
  createdAt: number
}

export type SetDifficulty = 'easy' | 'ok' | 'hard'

export interface WorkoutSet {
  reps: number
  weightKg: number
  /** How hard it felt — used for safe progression */
  difficulty?: SetDifficulty
  /** Set marked done via « Terminer la série ». */
  done?: boolean
  /** Seconds of rest logged after this set (rest timer). */
  restSec?: number
}

export interface ExerciseEntry {
  id: string
  name: string
  sets: WorkoutSet[]
  note?: string
}

export interface WorkoutNote {
  id: string
  title: string
  dateKey: string
  exercises: ExerciseEntry[]
  createdAt: number
  estimatedKcal: number
  /** Session length used for kcal (Poids × Durée × Intensité) */
  durationMin?: number
  /** Total kg lifted (reps × weight summed) */
  totalVolumeKg?: number
  /** Links to a saved focus routine (Upper, Legs, Pecs…) */
  routineId?: string
}

/** Persistent “bloc” — opens last exercises for that focus. */
export interface WorkoutRoutine {
  id: string
  label: string
  subtitle: string
  accent: string
  exercises: ExerciseEntry[]
  updatedAt: number
}

export interface TrainingState {
  primarySportId: string | null
  favoriteSportIds: string[]
  stepsToday: number
  stepsDateKey: string
  healthLinked: boolean
  notificationsEnabled: boolean
  templates: SessionTemplate[]
  schedule: ScheduledSession[]
  completed: CompletedSession[]
  workoutNotes: WorkoutNote[]
  routines: WorkoutRoutine[]
}
