/**
 * Epley estimated 1RM and safe progression helpers.
 * Educational estimates — not medical advice.
 */

import type { SetDifficulty, WorkoutSet } from '../types/training'

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

  // Max jump ~2.5% of load, or 1.25–2.5 kg, smaller if relative strength is already high
  const capPct = ratio >= 1.5 ? 0.015 : ratio >= 1 ? 0.02 : 0.025
  const maxJump = Math.max(1.25, Math.min(2.5, avgWeight * capPct))

  if (difficulty === 'hard') {
    const next = Math.round((last.weightKg * 0.95) * 4) / 4
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

/** Rough kcal from lifting volume (very approximate). */
export function volumeToKcal(volumeKg: number, durationMin: number): number {
  const fromVolume = volumeKg * 0.05
  const fromTime = (durationMin / 60) * 280
  return Math.round(Math.max(fromVolume, fromTime * 0.5) + fromTime * 0.5)
}
