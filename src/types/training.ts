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
  /** Higher = shown first in search / defaults */
  popularity: number
  /** Tracks steps / distance well */
  tracksSteps?: boolean
  /** Typical kcal/hour estimate for a 70kg person (rough) */
  kcalPerHour: number
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sun–Sat

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
  /** Soft accent for cards */
  accent: string
}

export interface ScheduledSession {
  id: string
  templateId: string
  title: string
  /** Days of week (0=dim … 6=sam) */
  days: Weekday[]
  /** "18:30" */
  time: string
  enabled: boolean
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

export interface TrainingState {
  primarySportId: string | null
  favoriteSportIds: string[]
  stepsToday: number
  stepsDateKey: string
  healthLinked: boolean
  templates: SessionTemplate[]
  schedule: ScheduledSession[]
  completed: CompletedSession[]
}
