/**
 * Epley estimated 1RM and safe progression helpers.
 * Educational estimates — not medical advice.
 */

import type { ExerciseEntry, SetDifficulty, WorkoutSet } from '../types/training'

export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return weightKg
  // Epley
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export function bestSet1RM(sets: WorkoutSet[]): number {
  let best = 0
  for (const set of sets) {
    best = Math.max(best, estimate1RM(set.weightKg, set.reps))
  }
  return best
}

export function relativeStrength(oneRm: number, bodyWeightKg: number): number {
  if (!(bodyWeightKg > 0) || !(oneRm > 0)) return 0
  return Math.round((oneRm / bodyWeightKg) * 100) / 100
}

export function totalVolume(sets: WorkoutSet[]): number {
  return Math.round(sets.reduce((sum, s) => sum + s.reps * s.weightKg, 0))
}

export function exercisesVolume(exercises: ExerciseEntry[]): number {
  return totalVolume(exercises.flatMap((e) => e.sets))
}

export function relativeStrengthLabel(ratio: number): string {
  if (ratio <= 0) return '—'
  if (ratio < 0.6) return 'Base'
  if (ratio < 1) return 'Intermédiaire'
  if (ratio < 1.5) return 'Solide'
  if (ratio < 2) return 'Avancé'
  return 'Élite'
}

/**
 * Suggest next working weight from last sets + how hard it felt.
 * Caps increases so progression stays safe relative to bodyweight capacity.
 */
export function suggestNextWeight(options: {
  sets: WorkoutSet[]
  bodyWeightKg: number
  difficulty?: SetDifficulty
}): { nextKg: number; message: string } | null {
  const { sets, bodyWeightKg, difficulty = 'ok' } = options
  if (!sets.length) return null
  const last = sets[sets.length - 1]
  const avgWeight =
    sets.reduce((s, x) => s + x.weightKg, 0) / Math.max(1, sets.length)
  const oneRm = bestSet1RM(sets)
  const ratio = relativeStrength(oneRm, bodyWeightKg)

  const capPct = ratio >= 1.5 ? 0.015 : ratio >= 1 ? 0.02 : 0.025
  const maxJump = Math.max(1.25, Math.min(2.5, avgWeight * capPct))

  if (difficulty === 'hard') {
    const next = Math.round(last.weightKg * 0.95 * 4) / 4
    return {
      nextKg: Math.max(0, next),
      message: `Série dure — garde ~${next} kg ou baisse un cran. Récupère bien.`,
    }
  }

  if (difficulty === 'easy') {
    const next = Math.round((last.weightKg + maxJump) * 4) / 4
    return {
      nextKg: next,
      message: `Facile : tu peux viser ~${next} kg la prochaine fois (+${maxJump} kg max, progression safe).`,
    }
  }

  const next = Math.round((last.weightKg + Math.min(1.25, maxJump)) * 4) / 4
  return {
    nextKg: next,
    message: `OK : consolide ou +${Math.min(1.25, maxJump)} kg (~${next} kg) si la technique est clean.`,
  }
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
