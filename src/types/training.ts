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
  /** Ressenti optionnel (Facile / OK / Dur) — informatif uniquement, ne prescrit plus la charge. */
  difficulty?: SetDifficulty
  /** RPE optionnel (1–10) — informatif, jamais obligatoire, jamais auto-progression. */
  rpe?: number
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

/** Famille de séance — additive ; absente sur les notes legacy. */
export type SessionKind = 'strength' | 'endurance' | 'team' | 'generic'

/** Provenance de la saisie — additive ; absente sur les notes legacy. */
export type SessionSource = 'manual' | 'import'

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
  /**
   * Sport réellement pratiqué au moment de la séance (figé à l’écriture).
   * Optionnel : notes legacy sans ce champ restent valides.
   */
  sportId?: string
  /**
   * Famille de module Train utilisée pour saisir la séance.
   * Optionnel : notes legacy sans ce champ restent valides.
   */
  sessionKind?: SessionKind
  /**
   * Source de la saisie (`manual` pour toutes les saisies UI actuelles).
   * Optionnel : notes legacy sans ce champ restent valides.
   */
  source?: SessionSource
  /**
   * Détails structurés selon le module (ex. distance endurance).
   * Optionnel : notes legacy et séances non-endurance restent valides sans ce champ.
   */
  details?: SessionDetails
}

/** Détails typés — endurance uniquement en V1 (extensible plus tard). */
export type EnduranceSessionDetails = {
  kind: 'endurance'
  /** Distance en km — nombre fini strictement positif. */
  distanceKm: number
}

export type SessionDetails = EnduranceSessionDetails

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
