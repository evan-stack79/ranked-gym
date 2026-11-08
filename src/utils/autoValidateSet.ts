import type { WorkoutSet } from '../types/training'

export const AUTO_VALIDATE_UNDO_MS = 5_000

/** Limites affichées / enregistrées — pas de clamp silencieux côté UI Train. */
export const SET_WEIGHT_MIN_KG = 0
export const SET_WEIGHT_MAX_KG = 500
export const SET_REPS_MIN = 1
export const SET_REPS_MAX = 50
export const SET_EFFORT_MIN = 1
export const SET_EFFORT_MAX = 10

export type AutoValidateFields = Pick<WorkoutSet, 'reps' | 'weightKg' | 'rpe' | 'done'>

export type SetFieldKind = 'weight' | 'reps' | 'effort'

/** Effort 1–10 (champ `rpe`). Ne jamais inventer une valeur. */
export function isValidEffort(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= SET_EFFORT_MIN &&
    value <= SET_EFFORT_MAX
  )
}

export function isWeightInRange(weightKg: unknown): weightKg is number {
  return (
    typeof weightKg === 'number' &&
    Number.isFinite(weightKg) &&
    weightKg >= SET_WEIGHT_MIN_KG &&
    weightKg <= SET_WEIGHT_MAX_KG
  )
}

export function isRepsInRange(reps: unknown): reps is number {
  return (
    typeof reps === 'number' &&
    Number.isFinite(reps) &&
    reps >= SET_REPS_MIN &&
    reps <= SET_REPS_MAX
  )
}

/** Message d’erreur champ (null si OK / vide). Écran = enregistré ; hors limites → bloquer. */
export function setFieldRangeError(
  kind: SetFieldKind,
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value)) return null
  if (kind === 'weight') {
    if (value < SET_WEIGHT_MIN_KG || value > SET_WEIGHT_MAX_KG) {
      return `Poids hors limites (0–${SET_WEIGHT_MAX_KG} kg)`
    }
    return null
  }
  if (kind === 'reps') {
    if (value < SET_REPS_MIN || value > SET_REPS_MAX) {
      return `Reps hors limites (${SET_REPS_MIN}–${SET_REPS_MAX})`
    }
    return null
  }
  if (value < SET_EFFORT_MIN || value > SET_EFFORT_MAX) {
    return `Effort hors limites (${SET_EFFORT_MIN}–${SET_EFFORT_MAX})`
  }
  return null
}

/**
 * Charge + reps + Effort (1–10) requis pour auto-validate.
 * Hors limites → pas prêt (rien n’est validé tant que ce n’est pas corrigé).
 */
export function isSetReadyForAutoValidate(set: AutoValidateFields): boolean {
  if (set.done === true) return false
  if (!isWeightInRange(set.weightKg)) return false
  if (!isRepsInRange(set.reps)) return false
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

/**
 * DEV-RG-07 : plus aucun append automatique de série (Reprendre / skip repos inclus).
 * Conservé pour les tests / appelants historiques — retourne toujours `false`.
 * Seul le bouton « + Ajouter une série » crée une série.
 */
export function shouldAppendNextSetOnRestSkip(
  _sets: Array<{ done?: boolean }>,
  _setIndex: number,
): boolean {
  return false
}
