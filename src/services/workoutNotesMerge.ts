/**
 * Fusion des séances Train par id — chaque note a son updatedAt.
 * Comme les verres d’eau : une séance offline n’est jamais effacée par un pull stale.
 */

import type { WorkoutNote } from '../types/training'

function noteClock(n: Pick<WorkoutNote, 'updatedAt' | 'createdAt'>): number {
  if (typeof n.updatedAt === 'number' && Number.isFinite(n.updatedAt) && n.updatedAt > 0) {
    return n.updatedAt
  }
  if (typeof n.createdAt === 'number' && Number.isFinite(n.createdAt) && n.createdAt > 0) {
    return n.createdAt
  }
  return 0
}

/**
 * Merge by id, newest updatedAt wins. Notes only on one side are kept.
 * Result sorted by createdAt desc (UI habit), capped at `limit`.
 */
export function mergeWorkoutNotesById(
  local: WorkoutNote[] | null | undefined,
  remote: WorkoutNote[] | null | undefined,
  limit = 80,
): WorkoutNote[] {
  const map = new Map<string, WorkoutNote>()
  for (const n of remote ?? []) {
    if (!n?.id) continue
    map.set(n.id, n)
  }
  for (const n of local ?? []) {
    if (!n?.id) continue
    const prev = map.get(n.id)
    if (!prev || noteClock(n) >= noteClock(prev)) {
      map.set(n.id, n)
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit)
}
