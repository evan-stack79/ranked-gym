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

/**
 * Unique validation Train kg / reps / effort — Valider, blur (commitOnBlur) et Terminer.
 * - `null` / `undefined` → ok (champ vide pendant la saisie / effort facultatif)
 * - `NaN` / `±Infinity` / hors bornes → message (valeur refusée, non sauvegardée)
 */
export function validateTrainSetNumber(
  kind: SetFieldKind,
  value: number | null | undefined,
): string | null {
  if (value == null) return null
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    if (kind === 'weight') return 'Poids invalide'
    if (kind === 'reps') return 'Reps invalides'
    return 'Effort invalide'
  }
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

/** Alias historique — même fonction que `validateTrainSetNumber`. */
export const setFieldRangeError = validateTrainSetNumber

/**
 * Bloque Terminer / Sauvegarder si une série non vide porte un kg/reps invalide
 * (NaN, Infinity, hors 0–500 kg / 1–50 reps). Les séries 0×0 restent filtrées.
 */
export function workoutSessionSaveError(
  exercises: Array<{ sets: Array<{ weightKg: number; reps: number }> }>,
): string | null {
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (typeof set.weightKg === 'number' && !Number.isFinite(set.weightKg)) {
        return validateTrainSetNumber('weight', set.weightKg)
      }
      if (typeof set.reps === 'number' && !Number.isFinite(set.reps)) {
        return validateTrainSetNumber('reps', set.reps)
      }
      // Placeholder 0×0 — Terminer les ignore ; pas d’erreur « reps hors limites ».
      if (set.reps === 0 && set.weightKg === 0) continue
      const weightErr = validateTrainSetNumber('weight', set.weightKg)
      if (weightErr) return weightErr
      if (set.reps !== 0) {
        const repsErr = validateTrainSetNumber('reps', set.reps)
        if (repsErr) return repsErr
      }
    }
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
