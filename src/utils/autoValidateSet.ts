import type { WorkoutSet } from '../types/training'

export const AUTO_VALIDATE_UNDO_MS = 5_000

export type AutoValidateFields = Pick<WorkoutSet, 'reps' | 'weightKg' | 'rpe' | 'done'>

/** Effort 1–10 (champ `rpe`). Ne jamais inventer une valeur. */
export function isValidEffort(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10
}

/**
 * Charge + reps + Effort (1–10) requis pour auto-validate.
 * Sans Effort choisi → pas prêt (rpe reste undefined).
 */
export function isSetReadyForAutoValidate(set: AutoValidateFields): boolean {
  if (set.done === true) return false
  if (!Number.isFinite(set.weightKg) || set.weightKg < 0) return false
  if (!Number.isFinite(set.reps) || set.reps < 1) return false
  return isValidEffort(set.rpe)
}

export function makeAutoValidateKey(
  exerciseId: string,
  setIndex: number,
  set: AutoValidateFields,
): string {
  return `${exerciseId}|${setIndex}|${set.weightKg}|${set.reps}|${set.rpe ?? ''}`
}

export function shouldCommitAutoValidate(input: {
  ready: boolean
  done: boolean
  key: string
  lastKey: string | null
}): boolean {
  if (!input.ready || input.done) return false
  if (input.lastKey === input.key) return false
  return true
}

export function nextSetHint(
  exercises: Array<{
    id: string
    name: string
    sets: Array<{ done?: boolean }>
  }>,
  exerciseId: string,
  setIndex: number,
): { exerciseName: string; setLabel: string } | null {
  const exIdx = exercises.findIndex((e) => e.id === exerciseId)
  if (exIdx < 0) return null
  const current = exercises[exIdx]
  const laterSame = current.sets.findIndex((s, i) => i > setIndex && s.done !== true)
  if (laterSame >= 0) {
    return {
      exerciseName: current.name.trim() || 'Exercice',
      setLabel: `Série ${laterSame + 1}`,
    }
  }
  for (let i = exIdx + 1; i < exercises.length; i += 1) {
    const pending = exercises[i].sets.findIndex((s) => s.done !== true)
    if (pending >= 0) {
      return {
        exerciseName: exercises[i].name.trim() || 'Exercice',
        setLabel: `Série ${pending + 1}`,
      }
    }
  }
  return null
}
