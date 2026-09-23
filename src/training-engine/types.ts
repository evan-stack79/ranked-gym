import type {
  CatalogExercise,
  ExerciseEquipment,
  ExerciseLevel,
} from '../data/exerciseCatalog'
import type { NutritionGoal } from '../types/nutrition'
import type { SetDifficulty } from '../types/training'

export type RecSlot = 'redo' | 'discover'

export type RecReasonCode =
  | 'frequent_movement'
  | 'complete_push'
  | 'complete_pull'
  | 'complete_legs'
  | 'goal_equipment'
  | 'sport_match'
  | 'level_match'

export type RecommendationHistoryEntry = {
  /** Null si l’entrée n’a pas d’id canonique (texte libre non mappé). */
  canonicalExerciseId: string | null
  completed: boolean
  createdAt: number
  dateKey: string
  difficulty?: SetDifficulty
}

export type RecommendationProfile = {
  /** Sports choisis. Vide + `sportsUndecided` = cold-start catalogue. */
  selectedSportIds: string[]
  sportsUndecided?: boolean
  goal?: NutritionGoal | null
  trainingLevel?: ExerciseLevel | null
  /**
   * Matériel déclaré. `null` / `[]` = non renseigné → pas de filtre matériel.
   * Ne jamais inventer un inventaire.
   */
  availableEquipment?: ExerciseEquipment[] | null
  dismissedExerciseIds?: string[]
  limitedExerciseIds?: string[]
  limitedMuscles?: string[]
  currentSessionCanonicalIds?: string[]
  history?: RecommendationHistoryEntry[]
  nowMs?: number
}

export type ScoredCandidate = {
  exercise: CatalogExercise
  score: number
  completionCount: number
  recentCompletion: boolean
  frequencyPoints: number
  complementPoints: number
  goalPoints: number
  sportPoints: number
  levelPoints: number
  equipmentPoints: number
  popularityPoints: number
  reasonCode: RecReasonCode
  reasonText: string
}

export type TrainingRecommendation = {
  slot: RecSlot
  canonicalExerciseId: string
  name: string
  reasonCode: RecReasonCode
  reasonText: string
  score: number
  /** Uniquement si calculable — sinon null, jamais une durée fictive. */
  durationMin: number | null
  imageSrc: string | null
}

export type RecommendationResult = {
  redo: TrainingRecommendation | null
  discover: TrainingRecommendation | null
  items: TrainingRecommendation[]
}
