import type { ExerciseEntry, WorkoutNote, WorkoutSet } from '../types/training'
import { dedupeWorkoutNotes, formatKgValue } from './workoutHistory'

/** Snapshot of a prior completed set used as an informative hint (never a prescription). */
export type LastPerformance = {
  weightKg: number
  reps: number
  dateKey: string
  /** Index of the set taken from the previous session (after fallback). */
  sourceSetIndex: number
}

export type ExerciseMatchKey = {
  name: string
  canonicalExerciseId?: string
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/** Match by canonical id when both sides have one; otherwise by display name. */
export function exerciseMatches(
  candidate: ExerciseMatchKey,
  needle: ExerciseMatchKey,
): boolean {
  const candId = candidate.canonicalExerciseId?.trim()
  const needleId = needle.canonicalExerciseId?.trim()
  if (candId && needleId) return candId === needleId
  const n = normalizeName(needle.name)
  if (!n) return false
  return normalizeName(candidate.name) === n
}

function isUsableSet(set: WorkoutSet | undefined): set is WorkoutSet {
  if (!set) return false
  // Reps > 0 = real logged set (poids 0 autorisé pour exercices au poids de corps).
  return Number.isFinite(set.reps) && set.reps > 0
}

/**
 * Pick the set at `setIndex` from a previous exercise, falling back to the last
 * usable set when that index is missing or empty.
 */
export function pickSetForIndex(
  sets: WorkoutSet[],
  setIndex: number,
): { set: WorkoutSet; sourceSetIndex: number } | null {
  if (!sets.length) return null
  const atIndex = sets[setIndex]
  if (isUsableSet(atIndex)) {
    return { set: atIndex, sourceSetIndex: setIndex }
  }
  for (let i = sets.length - 1; i >= 0; i -= 1) {
    if (isUsableSet(sets[i])) {
      return { set: sets[i]!, sourceSetIndex: i }
    }
  }
  return null
}

/**
 * Most recent completed session that contains the same exercise, then the set
 * at `setIndex` (or the last set of that exercise).
 * Client-side only — uses already-loaded `workoutNotes`.
 */
export function findLastPerformance(
  history: WorkoutNote[],
  exercise: ExerciseMatchKey,
  setIndex: number,
  options?: { excludeNoteId?: string },
): LastPerformance | null {
  if (!Number.isFinite(setIndex) || setIndex < 0) return null
  const needleName = normalizeName(exercise.name)
  const needleId = exercise.canonicalExerciseId?.trim()
  if (!needleName && !needleId) return null

  const notes = dedupeWorkoutNotes(history)
  for (const note of notes) {
    if (options?.excludeNoteId && note.id === options.excludeNoteId) continue
    for (const ex of note.exercises) {
      if (!exerciseMatches(ex, exercise)) continue
      const picked = pickSetForIndex(ex.sets, setIndex)
      if (!picked) continue
      const { set, sourceSetIndex } = picked
      return {
        weightKg: set.weightKg,
        reps: set.reps,
        dateKey: note.dateKey,
        sourceSetIndex,
      }
    }
  }
  return null
}

/** True when the set has no load entered yet (empty kg + empty reps, not done). */
export function isSetLoadBlank(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'done'>,
): boolean {
  if (set.done) return false
  const weightEmpty = !Number.isFinite(set.weightKg) || set.weightKg === 0
  const repsEmpty = !Number.isFinite(set.reps) || set.reps === 0
  return weightEmpty && repsEmpty
}

/** Grey placeholder for the kg field (e.g. « 60 »). */
export function formatLastWeightPlaceholder(weightKg: number): string {
  return formatKgValue(weightKg)
}

/** Grey placeholder for the reps field (e.g. « 8 »). */
export function formatLastRepsPlaceholder(reps: number): string {
  return String(reps)
}

/** Accessible label when the kg field shows a last-time placeholder. */
export function formatLastWeightAriaLabel(weightKg: number): string {
  return `kg, la dernière fois ${formatKgValue(weightKg)}`
}

/** Accessible label when the reps field shows a last-time placeholder. */
export function formatLastRepsAriaLabel(reps: number): string {
  return `reps, la dernière fois ${reps}`
}

/** Patch applied when the athlete taps an empty field — weight + reps only (not Effort). */
export function lastPerformanceToSetPatch(
  perf: LastPerformance,
): Pick<WorkoutSet, 'weightKg' | 'reps'> {
  return { weightKg: perf.weightKg, reps: perf.reps }
}

const DEFAULT_NEW_SET: WorkoutSet = { reps: 8, weightKg: 20 }

/**
 * Prefill for « + Ajouter une série » from the previous set in the current session.
 * Copies load only (weight + reps); clears done / Effort / rest.
 */
export function nextSetFromPrevious(previous: WorkoutSet | undefined): WorkoutSet {
  if (!previous || !Number.isFinite(previous.reps) || !Number.isFinite(previous.weightKg)) {
    return { ...DEFAULT_NEW_SET }
  }
  return {
    reps: previous.reps > 0 ? previous.reps : DEFAULT_NEW_SET.reps,
    weightKg: previous.weightKg >= 0 ? previous.weightKg : DEFAULT_NEW_SET.weightKg,
  }
}

/** Convenience: resolve last performance for every set row of an exercise. */
export function lastPerformancesForExercise(
  history: WorkoutNote[],
  exercise: Pick<ExerciseEntry, 'name' | 'canonicalExerciseId' | 'sets'>,
  options?: { excludeNoteId?: string },
): Array<LastPerformance | null> {
  return exercise.sets.map((_, idx) =>
    findLastPerformance(history, exercise, idx, options),
  )
}
