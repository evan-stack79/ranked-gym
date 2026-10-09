/**
 * Suggestion de charge programme Débutant — jamais forcée.
 * +2 % à +10 % max si 1–2 reps au-dessus de la cible, deux séances d’affilée
 * pour le MÊME catalogId (swap = autre id → historique séparé).
 */

import {
  BEGINNER_TARGET_REPS_MAX,
  BEGINNER_TARGET_REPS_MIN,
  LOAD_SUGGEST_EXTRA_REPS_MAX,
  LOAD_SUGGEST_EXTRA_REPS_MIN,
  LOAD_SUGGEST_MAX_PCT,
  LOAD_SUGGEST_MIN_PCT,
} from '../data/beginnerProgramme'
import type { WorkoutNote } from '../types/training'

export type LoadSuggestInput = {
  catalogId: string
  /** Historique de séances (plus récentes en tête ou non — on trie). */
  notes: WorkoutNote[]
  /** Reps cibles planifiées (défaut 8–12 → on prend le max planifié). */
  plannedReps?: number
}

export type LoadSuggestResult = {
  suggest: boolean
  /** Facteur 1.02–1.10 si suggest. */
  factor: number
  /** Charge précédente (kg) sur laquelle appliquer le facteur. */
  previousWeightKg: number | null
}

function plannedRepsOf(input: LoadSuggestInput): number {
  if (
    typeof input.plannedReps === 'number' &&
    Number.isFinite(input.plannedReps) &&
    input.plannedReps > 0
  ) {
    return Math.round(input.plannedReps)
  }
  return BEGINNER_TARGET_REPS_MAX
}

/** Meilleures reps (max série done ou max série) pour un exo dans une note. */
function bestRepsForExercise(note: WorkoutNote, catalogId: string): number | null {
  let best: number | null = null
  for (const ex of note.exercises ?? []) {
    if (ex.canonicalExerciseId !== catalogId) continue
    for (const set of ex.sets ?? []) {
      if (typeof set.reps !== 'number' || !Number.isFinite(set.reps)) continue
      if (best == null || set.reps > best) best = set.reps
    }
  }
  return best
}

function bestWeightForExercise(note: WorkoutNote, catalogId: string): number | null {
  let best: number | null = null
  for (const ex of note.exercises ?? []) {
    if (ex.canonicalExerciseId !== catalogId) continue
    for (const set of ex.sets ?? []) {
      if (typeof set.weightKg !== 'number' || !Number.isFinite(set.weightKg)) continue
      if (set.weightKg <= 0) continue
      if (best == null || set.weightKg > best) best = set.weightKg
    }
  }
  return best
}

function exceedsPlannedByOneOrTwo(reps: number, planned: number): boolean {
  const extra = reps - planned
  return extra >= LOAD_SUGGEST_EXTRA_REPS_MIN && extra <= LOAD_SUGGEST_EXTRA_REPS_MAX
}

/**
 * Deux séances d’affilée (par dateKey Paris / createdAt) où l’exo a 1–2 reps
 * de plus que prévu → suggestion +2..10 %. Jamais d’écriture de charge.
 */
export function suggestLoadIncrease(input: LoadSuggestInput): LoadSuggestResult {
  const planned = plannedRepsOf(input)
  const sorted = [...(input.notes ?? [])].sort((a, b) => {
    const ak = a.dateKey ?? ''
    const bk = b.dateKey ?? ''
    if (ak !== bk) return bk.localeCompare(ak)
    return (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })

  const withExo: WorkoutNote[] = []
  for (const n of sorted) {
    if (bestRepsForExercise(n, input.catalogId) != null) withExo.push(n)
    if (withExo.length >= 2) break
  }
  if (withExo.length < 2) {
    return { suggest: false, factor: 1, previousWeightKg: null }
  }

  const [latest, previous] = withExo
  const r1 = bestRepsForExercise(latest!, input.catalogId)
  const r0 = bestRepsForExercise(previous!, input.catalogId)
  if (r1 == null || r0 == null) {
    return { suggest: false, factor: 1, previousWeightKg: null }
  }
  if (!exceedsPlannedByOneOrTwo(r1, planned) || !exceedsPlannedByOneOrTwo(r0, planned)) {
    return { suggest: false, factor: 1, previousWeightKg: null }
  }

  const weight = bestWeightForExercise(latest!, input.catalogId)
  // Facteur milieu de bande — l’UI propose, l’utilisateur choisit.
  const factor =
    LOAD_SUGGEST_MIN_PCT + (LOAD_SUGGEST_MAX_PCT - LOAD_SUGGEST_MIN_PCT) * 0.5
  return {
    suggest: true,
    factor: 1 + factor,
    previousWeightKg: weight,
  }
}

/** Clamp d’un % de suggestion dans [2 %, 10 %]. */
export function clampLoadSuggestPct(pct: number): number {
  if (!Number.isFinite(pct)) return LOAD_SUGGEST_MIN_PCT
  return Math.min(LOAD_SUGGEST_MAX_PCT, Math.max(LOAD_SUGGEST_MIN_PCT, pct))
}

export function isWithinBeginnerRepRange(reps: number): boolean {
  return (
    Number.isFinite(reps) &&
    reps >= BEGINNER_TARGET_REPS_MIN &&
    reps <= BEGINNER_TARGET_REPS_MAX + LOAD_SUGGEST_EXTRA_REPS_MAX
  )
}
