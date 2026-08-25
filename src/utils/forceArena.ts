/**
 * Force Arena — utilitaires de progression (legacy).
 * Conservés pour ForceView / applyForceProgression.
 * Le carnet Train V1 ne prescrit plus automatiquement les charges via ce module.
 */
import type { SetDifficulty, WorkoutRoutine, WorkoutSet } from '../types/training'
import { bestSet1RM, relativeStrength, suggestNextWeight } from './strength'

/**
 * Arena score: bodyweight-normalized, soft curve so beginners and advanced
 * both climb meaningfully without impossible gaps.
 */
export function arenaStrengthScore(ratio: number): number {
  if (!(ratio > 0)) return 0
  // Smooth saturation around ~1.5–2× BW
  const score = 1000 * Math.tanh(ratio / 1.15)
  return Math.round(score)
}

export function arenaBand(score: number): { label: string; hint: string } {
  if (score < 250) {
    return { label: 'Bronze Force', hint: 'Parfait pour démarrer — chaque kilo compte autant qu’en haut.' }
  }
  if (score < 450) {
    return { label: 'Argent Force', hint: 'Tu grimpes. La concurrence reste dans ta zone.' }
  }
  if (score < 650) {
    return { label: 'Or Force', hint: 'Solide. Tu pushes, sans écraser les autres niveaux.' }
  }
  if (score < 820) {
    return { label: 'Platine Force', hint: 'Élite accessible — la courbe reste juste pour tout le monde.' }
  }
  return { label: 'Diamant Force', hint: 'Top niveau. Le score plafonne doucement : pas de gap injuste.' }
}

export interface ForceLiftRow {
  routineId: string
  routineLabel: string
  exerciseName: string
  lastSets: WorkoutSet[]
  oneRm: number
  ratio: number
  score: number
  suggestedNextKg: number | null
  tip: string
  lastDifficulty: SetDifficulty
}

export function buildForceRows(routines: WorkoutRoutine[], bodyWeightKg: number): ForceLiftRow[] {
  const rows: ForceLiftRow[] = []
  for (const routine of routines) {
    for (const ex of routine.exercises) {
      if (!ex.sets.length || !ex.name.trim()) continue
      const oneRm = bestSet1RM(ex.sets)
      if (oneRm <= 0) continue
      const ratio = relativeStrength(oneRm, bodyWeightKg)
      const last = ex.sets[ex.sets.length - 1]
      const difficulty = last.difficulty ?? 'ok'
      const tip = suggestNextWeight({
        sets: ex.sets,
        bodyWeightKg,
        difficulty,
      })
      rows.push({
        routineId: routine.id,
        routineLabel: routine.label,
        exerciseName: ex.name,
        lastSets: ex.sets,
        oneRm,
        ratio,
        score: arenaStrengthScore(ratio),
        suggestedNextKg: tip?.nextKg ?? null,
        tip: tip?.message ?? '',
        lastDifficulty: difficulty,
      })
    }
  }
  return rows.sort((a, b) => b.score - a.score)
}

export function totalArenaScore(rows: ForceLiftRow[]): number {
  if (!rows.length) return 0
  // Average of top lifts — rewards balance, not one monster lift only
  const top = rows.slice(0, 5)
  return Math.round(top.reduce((s, r) => s + r.score, 0) / top.length)
}

/** Auto-progress working weights on a routine from last set difficulties. */
export function progressRoutineExercises(
  routine: WorkoutRoutine,
  bodyWeightKg: number,
): WorkoutRoutine {
  const exercises = routine.exercises.map((ex) => {
    if (!ex.sets.length) return ex
    const difficulty = ex.sets[ex.sets.length - 1]?.difficulty ?? 'ok'
    const tip = suggestNextWeight({ sets: ex.sets, bodyWeightKg, difficulty })
    if (!tip) return ex
    const sets = ex.sets.map((s) => ({
      ...s,
      weightKg: tip.nextKg,
      // reset feel for next session
      difficulty: 'ok' as SetDifficulty,
    }))
    return { ...ex, sets }
  })
  return { ...routine, exercises, updatedAt: Date.now() }
}
