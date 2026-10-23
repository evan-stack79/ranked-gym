export type SetGroupKind = 'straight' | 'superset' | 'circuit'

export interface ContractSet {
  reps: number
  weightKg: number
  rpe?: number
  done?: boolean
  restSec?: number
  status?: 'queued' | 'active' | 'done' | 'skipped'
}

export interface ContractExercise {
  id: string
  name?: string
  sets: ContractSet[]
  canonicalExerciseId?: string
  targetRestSec?: number
}

export interface ContractSetGroup {
  id: string
  kind: SetGroupKind
  exerciseIds: string[]
  sets: ContractSet[]
  defaultRestSec?: number
}

export interface ContractNote {
  exercises?: ContractExercise[]
  setGroups?: ContractSetGroup[]
  schemaVersion?: number
}

/**
 * v1 : un groupe straight par exercice, séries d’origine conservées.
 * v2 : les setGroups déjà écrits sont lus tels quels.
 */
export function readSetGroups(note: ContractNote): ContractSetGroup[] {
  if (Array.isArray(note.setGroups) && note.setGroups.length > 0) return note.setGroups
  return (note.exercises ?? []).map((exercise) => ({
    id: `straight:${exercise.id}`,
    kind: 'straight' as const,
    exerciseIds: [exercise.id],
    sets: exercise.sets,
    defaultRestSec: exercise.targetRestSec,
  }))
}

/**
 * Écrit le contrat v2 sans retirer les champs legacy (`exercises`, etc.).
 */
export function withAdditiveSetGroups<T extends ContractNote>(
  note: T,
  groups: ContractSetGroup[],
): T & { schemaVersion: 2; setGroups: ContractSetGroup[] } {
  return {
    ...note,
    schemaVersion: 2,
    setGroups: groups,
  }
}
