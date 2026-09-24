import { EXERCISE_CATALOG, type CatalogExercise } from '../data/exerciseCatalog'
import { resolveExerciseMedia } from '../utils/exerciseMedia'
import type { ExerciseEntry, TrainingState, WorkoutNote } from '../types/training'
import type { NutritionGoal } from '../types/nutrition'
import type {
  RecReasonCode,
  RecommendationHistoryEntry,
  RecommendationProfile,
  RecommendationResult,
  ScoredCandidate,
  TrainingRecommendation,
} from './types'

export const REC_SCORE = {
  frequencyPerCompletion: 40,
  frequencyCap: 5,
  recent: 30,
  sport: 25,
  complement: 20,
  goal: 12,
  level: 10,
  equipment: 8,
} as const

const REASON_TEXT: Record<RecReasonCode, string> = {
  frequent_movement: 'Parce que tu réalises souvent ce mouvement',
  complete_push: 'Pour compléter ton entraînement de poussée',
  complete_pull: 'Pour compléter ton entraînement de tirage',
  complete_legs: 'Pour compléter ton entraînement de jambes',
  goal_equipment: 'Adapté à ton objectif et à ton matériel',
  sport_match: 'Adapté aux sports que tu as choisis',
  level_match: 'Adapté à ton niveau',
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function unique(ids: string[] | undefined): string[] {
  if (!ids) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function resolveCanonicalExerciseId(entry: {
  canonicalExerciseId?: string | null
  name?: string | null
}): string | null {
  const fromField = entry.canonicalExerciseId?.trim()
  if (fromField && EXERCISE_CATALOG.some((ex) => ex.id === fromField)) {
    return fromField
  }
  // Uniquement le mapping fiable déjà utilisé par les médias — pas de fuzzy sur le titre.
  return resolveExerciseMedia({
    name: entry.name,
    canonicalExerciseId: entry.canonicalExerciseId,
  }).canonicalExerciseId
}

export function historyFromNotes(notes: WorkoutNote[]): RecommendationHistoryEntry[] {
  const rows: RecommendationHistoryEntry[] = []
  for (const note of notes) {
    for (const ex of note.exercises ?? []) {
      rows.push({
        canonicalExerciseId: resolveCanonicalExerciseId(ex),
        completed: true,
        createdAt: note.createdAt,
        dateKey: note.dateKey,
        difficulty: ex.sets?.find((s) => s.difficulty)?.difficulty,
      })
    }
  }
  return rows
}

export function currentSessionCanonicalIds(exercises: ExerciseEntry[] | undefined): string[] {
  const ids: string[] = []
  for (const ex of exercises ?? []) {
    const id = resolveCanonicalExerciseId(ex)
    if (id) ids.push(id)
  }
  return unique(ids)
}

function declaredEquipment(profile: RecommendationProfile): string[] {
  return unique((profile.availableEquipment ?? []).filter(Boolean))
}

function sessionMovements(currentIds: string[]): Set<CatalogExercise['movement']> {
  const set = new Set<CatalogExercise['movement']>()
  for (const id of currentIds) {
    const ex = EXERCISE_CATALOG.find((item) => item.id === id)
    if (ex) set.add(ex.movement)
  }
  return set
}

function isExcluded(ex: CatalogExercise, profile: RecommendationProfile): boolean {
  const dismissed = new Set(profile.dismissedExerciseIds ?? [])
  if (dismissed.has(ex.id)) return true
  const limited = new Set(profile.limitedExerciseIds ?? [])
  if (limited.has(ex.id)) return true
  const limitedMuscles = new Set((profile.limitedMuscles ?? []).map((m) => m.trim()).filter(Boolean))
  if (limitedMuscles.size > 0 && ex.muscles.some((m) => limitedMuscles.has(m))) return true
  const current = new Set(profile.currentSessionCanonicalIds ?? [])
  if (current.has(ex.id)) return true
  const equipment = declaredEquipment(profile)
  if (equipment.length > 0 && !equipment.includes(ex.equipment)) return true
  if (profile.trainingLevel === 'beginner' && ex.level === 'advanced') return true
  return false
}

function matchesSelectedSports(ex: CatalogExercise, profile: RecommendationProfile): boolean {
  if (profile.sportsUndecided) return true
  const sports = unique(profile.selectedSportIds)
  if (sports.length === 0) return false
  return ex.sportIds.some((id) => sports.includes(id))
}

function goalPoints(ex: CatalogExercise, goal: NutritionGoal | null | undefined): number {
  if (!goal) return 0
  if (goal === 'bulk' && ex.effortType === 'hypertrophy') return REC_SCORE.goal
  if (goal === 'cut' && (ex.effortType === 'endurance' || ex.effortType === 'hypertrophy')) {
    return REC_SCORE.goal
  }
  if (goal === 'maintain' && ex.effortType === 'strength') return REC_SCORE.goal
  return 0
}

function complementPoints(
  ex: CatalogExercise,
  movements: Set<CatalogExercise['movement']>,
): { points: number; code: RecReasonCode | null } {
  if (movements.size === 0) return { points: 0, code: null }
  if (movements.has('push') && ex.movement === 'pull') {
    return { points: REC_SCORE.complement, code: 'complete_pull' }
  }
  if (movements.has('pull') && ex.movement === 'push') {
    return { points: REC_SCORE.complement, code: 'complete_push' }
  }
  if ((movements.has('push') || movements.has('pull')) && ex.movement === 'legs') {
    return { points: REC_SCORE.complement, code: 'complete_legs' }
  }
  if (movements.has('legs') && (ex.movement === 'push' || ex.movement === 'pull')) {
    return {
      points: REC_SCORE.complement,
      code: ex.movement === 'push' ? 'complete_push' : 'complete_pull',
    }
  }
  return { points: 0, code: null }
}

function pickReason(candidate: {
  frequencyPoints: number
  complementCode: RecReasonCode | null
  goalPoints: number
  equipmentPoints: number
  sportPoints: number
  levelPoints: number
}): RecReasonCode {
  if (candidate.frequencyPoints >= REC_SCORE.frequencyPerCompletion * 2) return 'frequent_movement'
  if (candidate.complementCode) return candidate.complementCode
  if (candidate.goalPoints > 0 || candidate.equipmentPoints > 0) return 'goal_equipment'
  if (candidate.sportPoints > 0) return 'sport_match'
  if (candidate.levelPoints > 0) return 'level_match'
  return 'sport_match'
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score
  if (b.exercise.popularity !== a.exercise.popularity) {
    return b.exercise.popularity - a.exercise.popularity
  }
  return a.exercise.id.localeCompare(b.exercise.id)
}

function toRecommendation(slot: 'redo' | 'discover', scored: ScoredCandidate): TrainingRecommendation {
  return {
    slot,
    canonicalExerciseId: scored.exercise.id,
    name: scored.exercise.name,
    reasonCode: scored.reasonCode,
    reasonText: scored.reasonText,
    score: scored.score,
    durationMin: null,
    imageSrc: null,
  }
}

export function scoreCatalogCandidates(
  profile: RecommendationProfile,
  catalog: CatalogExercise[] = EXERCISE_CATALOG,
): ScoredCandidate[] {
  const now = profile.nowMs ?? 0
  const history = profile.history ?? []
  const movements = sessionMovements(profile.currentSessionCanonicalIds ?? [])
  const equipment = declaredEquipment(profile)
  const scored: ScoredCandidate[] = []

  for (const exercise of catalog) {
    if (isExcluded(exercise, profile)) continue
    if (!matchesSelectedSports(exercise, profile)) continue

    const completions = history.filter(
      (row) => row.completed && row.canonicalExerciseId === exercise.id,
    )
    const completionCount = completions.length
    const recentCompletion =
      now > 0 && completions.some((row) => now - row.createdAt <= FOURTEEN_DAYS_MS)
    const frequencyPoints =
      Math.min(REC_SCORE.frequencyCap, completionCount) * REC_SCORE.frequencyPerCompletion
    const recentPoints = recentCompletion ? REC_SCORE.recent : 0
    const sportPoints = REC_SCORE.sport
    const complement = complementPoints(exercise, movements)
    const gPoints = goalPoints(exercise, profile.goal)
    const levelPoints =
      profile.trainingLevel && exercise.level === profile.trainingLevel ? REC_SCORE.level : 0
    const equipmentPoints =
      equipment.length > 0 && equipment.includes(exercise.equipment) ? REC_SCORE.equipment : 0
    const popularityPoints = Math.floor(exercise.popularity / 20)

    const partial = {
      completionCount,
      recentCompletion,
      frequencyPoints,
      complementPoints: complement.points,
      goalPoints: gPoints,
      sportPoints,
      levelPoints,
      equipmentPoints,
      popularityPoints,
      complementCode: complement.code,
    }
    const reasonCode = pickReason(partial)
    scored.push({
      exercise,
      score:
        frequencyPoints +
        recentPoints +
        sportPoints +
        complement.points +
        gPoints +
        levelPoints +
        equipmentPoints +
        popularityPoints,
      completionCount,
      recentCompletion,
      frequencyPoints,
      complementPoints: complement.points,
      goalPoints: gPoints,
      sportPoints,
      levelPoints,
      equipmentPoints,
      popularityPoints,
      reasonCode,
      reasonText: REASON_TEXT[reasonCode],
    })
  }

  return scored.sort(compareCandidates)
}

export function recommendExercises(profile: RecommendationProfile): RecommendationResult {
  const scored = scoreCatalogCandidates(profile)
  if (scored.length === 0) {
    return { redo: null, discover: null, items: [] }
  }

  const hasHistory = scored.some((row) => row.completionCount > 0)
  const redoPool = scored.filter((row) =>
    hasHistory ? row.completionCount >= 2 || (row.completionCount >= 1 && row.recentCompletion) : false,
  )
  const redo = redoPool[0] ?? (hasHistory ? scored.find((row) => row.completionCount >= 1) ?? null : null)

  const discoverPool = scored.filter((row) => {
    if (redo && row.exercise.id === redo.exercise.id) return false
    return row.completionCount === 0
  })
  const discover = discoverPool[0] ?? null

  const items: TrainingRecommendation[] = []
  const redoCard = redo ? toRecommendation('redo', redo) : null
  const discoverCard = discover ? toRecommendation('discover', discover) : null
  if (redoCard) items.push(redoCard)
  if (discoverCard) items.push(discoverCard)

  if (items.length === 0 && !hasHistory) {
    items.push(toRecommendation('discover', scored[0]))
    return { redo: null, discover: items[0], items }
  }

  return { redo: redoCard, discover: discoverCard, items }
}

/** Dernier log réel de cet id — nombre de séries, ou null. */
export function lastLoggedSetCount(
  notes: WorkoutNote[] | undefined,
  canonicalId: string,
): number | null {
  if (!canonicalId) return null
  let best: { createdAt: number; count: number } | null = null
  for (const note of notes ?? []) {
    for (const ex of note.exercises ?? []) {
      if (ex.canonicalExerciseId !== canonicalId) continue
      const count = ex.sets?.length ?? 0
      if (count <= 0) continue
      const createdAt = note.createdAt ?? 0
      if (!best || createdAt >= best.createdAt) {
        best = { createdAt, count }
      }
    }
  }
  return best?.count ?? null
}

export function recommendationProfileFromState(
  state: TrainingState,
  opts?: {
    goal?: NutritionGoal | null
    nowMs?: number
  },
): RecommendationProfile {
  const activeRoutine = state.activeWorkoutDraft
    ? state.routines.find((r) => r.id === state.activeWorkoutDraft?.routineId)
    : undefined
  return {
    selectedSportIds: state.sportsUndecided ? [] : state.favoriteSportIds,
    sportsUndecided: state.sportsUndecided === true,
    goal: opts?.goal ?? null,
    trainingLevel: state.trainingLevel ?? null,
    availableEquipment: state.availableEquipment ?? null,
    dismissedExerciseIds: state.dismissedExerciseIds ?? [],
    limitedExerciseIds: state.limitedExerciseIds ?? [],
    limitedMuscles: state.limitedMuscles ?? [],
    currentSessionCanonicalIds: currentSessionCanonicalIds(activeRoutine?.exercises),
    history: historyFromNotes(state.workoutNotes ?? []),
    nowMs: opts?.nowMs,
  }
}
