/**
 * Volume, durée estimée et kcal informatives pour le carnet Train.
 * Les facteurs d’intensité (Facile / OK / Dur) n’ajustent que l’estimation kcal —
 * jamais les charges de la prochaine séance.
 */

import type { ExerciseEntry, SetDifficulty, WorkoutSet } from '../types/training'

export function totalVolume(sets: WorkoutSet[]): number {
  return Math.round(sets.reduce((sum, s) => sum + s.reps * s.weightKg, 0))
}

export function exercisesVolume(exercises: ExerciseEntry[]): number {
  return totalVolume(exercises.flatMap((e) => e.sets))
}

/** Fixed minutes per set (effort + rest) — deterministic duration. */
export const MINUTES_PER_SET = 2.5

const INTENSITY_BY_DIFF: Record<SetDifficulty, number> = {
  easy: 0.065,
  ok: 0.085,
  hard: 0.11,
}

/** Average intensity factor from set difficulties (kcal / kg / min). */
export function sessionIntensity(exercises: ExerciseEntry[]): number {
  const diffs = exercises.flatMap((e) => e.sets.map((s) => s.difficulty ?? 'ok'))
  if (!diffs.length) return INTENSITY_BY_DIFF.ok
  const sum = diffs.reduce((acc, d) => acc + INTENSITY_BY_DIFF[d], 0)
  return Math.round((sum / diffs.length) * 1000) / 1000
}

export function estimateSessionDurationMin(exercises: ExerciseEntry[]): number {
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0)
  return Math.max(15, Math.round(sets * MINUTES_PER_SET))
}

/**
 * Fixed formula: Poids (kg) × Durée (min) × Intensité.
 * Same inputs → same kcal (no random drift).
 */
export function strengthSessionKcal(
  bodyWeightKg: number,
  durationMin: number,
  intensity: number,
): number {
  const w = Math.max(40, bodyWeightKg)
  const d = Math.max(1, durationMin)
  const i = Math.max(0.04, Math.min(0.15, intensity))
  return Math.round(w * d * i)
}

export function computeStrengthSessionStats(
  exercises: ExerciseEntry[],
  bodyWeightKg: number,
): { volume: number; durationMin: number; intensity: number; kcal: number } {
  const volume = exercisesVolume(exercises)
  const durationMin = estimateSessionDurationMin(exercises)
  const intensity = sessionIntensity(exercises)
  const kcal = strengthSessionKcal(bodyWeightKg, durationMin, intensity)
  return { volume, durationMin, intensity, kcal }
}

/** Legacy bridge */
export function volumeToKcal(volumeKg: number, durationMin: number): number {
  const intensity = volumeKg > 0 ? Math.min(0.12, 0.05 + volumeKg / 40000) : 0.085
  return strengthSessionKcal(70, durationMin, intensity)
}
