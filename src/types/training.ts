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
  /** Sport planifié, figé à la création. Absent sur les créneaux legacy. */
  sportId?: string
  /** Parcours Train à ouvrir. Absent sur les créneaux legacy. */
  sessionKind?: SessionKind
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
  /**
   * Stable exercise type for media / catalog (e.g. `bench_press`).
   * Additive — free-text-only entries (legacy / user-typed) omit this field.
   * Never infer from ambiguous titles like « DÉVELOPPER ».
   */
  canonicalExerciseId?: string
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

/** Détails typés par module — extensible (endurance, team, …). */
export type EnduranceSessionDetails = {
  kind: 'endurance'
  /** Distance en km — nombre fini strictement positif. */
  distanceKm: number
}

export type TeamSessionType = 'training' | 'match'

export type TeamSessionDetails = {
  kind: 'team'
  sessionType: TeamSessionType
  /** Minutes effectivement jouées — facultatif, ≤ durée de séance. */
  minutesPlayed?: number
  /** Poste libre — facultatif. */
  position?: string
}

export type SessionDetails = EnduranceSessionDetails | TeamSessionDetails

/** Persistent “bloc” — opens last exercises for that focus. */
export interface WorkoutRoutine {
  id: string
  label: string
  subtitle: string
  accent: string
  exercises: ExerciseEntry[]
  updatedAt: number
}

/**
 * Identité explicite de l'unique séance de musculation en cours.
 * Additive : les états legacy sans ce champ restent valides et ne sont jamais
 * assimilés automatiquement à une séance active à partir de seuls marqueurs `done`.
 */
export interface ActiveWorkoutDraft {
  routineId: string
  sportId: string
  startedAt: number
  updatedAt: number
  /**
   * Millisecondes chronométrées hors pause (durée réelle).
   * Absent sur les brouillons legacy → la mesure démarre à la reprise (pas startedAt).
   */
  elapsedActiveMs?: number
  /**
   * Horodatage du début du segment courant. `null` si en pause.
   * Absent sur legacy.
   */
  runningSince?: number | null
  /** true = chronomètre en pause. Absent/false = en cours. */
  paused?: boolean
  /**
   * Estimation figée (legacy) : wall-clock startedAt→reprise.
   * Ne compte jamais comme durée réellement chronométrée.
   */
  estimatedElapsedMs?: number
  /**
   * Snapshot minuteur de repos (optionnel).
   * Persiste décompte / pause à travers refresh. Absent = pas de repos actif.
   */
  restTimer?: {
    totalSec: number
    remainingSec: number
    endsAt: number
    paused: boolean
    target: {
      exerciseId: string
      setIndex: number
      exerciseName: string
      setLabel: string
      setCount?: number
    }
  } | null
  /**
   * Index d’exercice affiché sur l’écran immersif.
   * Restauré à la reprise ; absent = 0.
   */
  activeExerciseIndex?: number
}

/** Dernière route quittée volontairement (soft-leave séance → hub). */
export type LastVoluntaryRoute = 'train-hub'

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
  /**
   * Dernière routine sélectionnée dans le carnet Train (reprise type YouTube).
   * Persistée immédiatement au changement — ne dépend pas d’un événement de fermeture.
   */
  lastSelectedRoutineId: string | null
  /** Sport associé à la dernière sélection (évite une reprise incompatible). */
  lastSelectedSportId: string | null
  /** Brouillon réellement actif ; absent/null pour les états legacy ou terminés. */
  activeWorkoutDraft?: ActiveWorkoutDraft | null
  /**
   * Soft-leave volontaire vers le hub Train.
   * Si `train-hub` + brouillon actif → rester sur hub (« Reprendre »), ne pas rouvrir auto.
   * Absent/null → reprise inattendue (cold start / OS) peut rouvrir la séance.
   */
  lastVoluntaryRoute?: LastVoluntaryRoute | null
}
