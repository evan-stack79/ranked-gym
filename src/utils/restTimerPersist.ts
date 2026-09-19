/**
 * Snapshot persisté du minuteur de repos (clé Train existante).
 * endsAt absolu → survie au rafraîchissement sans dérive de tick.
 */
export type PersistedRestTarget = {
  exerciseId: string
  setIndex: number
  exerciseName: string
  setLabel: string
  /** Total de séries de l'exercice (optionnel, pour Live Activity). */
  setCount?: number
}

export type PersistedRestTimer = {
  totalSec: number
  /** Restant figé si paused ; sinon recalculé via endsAt. */
  remainingSec: number
  endsAt: number
  paused: boolean
  target: PersistedRestTarget
}

export function sanitizeRestTarget(value: unknown): PersistedRestTarget | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<PersistedRestTarget>
  if (typeof raw.exerciseId !== 'string' || !raw.exerciseId.trim()) return null
  if (typeof raw.exerciseName !== 'string') return null
  if (typeof raw.setLabel !== 'string') return null
  if (!Number.isFinite(raw.setIndex) || (raw.setIndex as number) < 0) return null
  const setCount =
    Number.isFinite(raw.setCount) && (raw.setCount as number) > 0
      ? Math.floor(raw.setCount as number)
      : undefined
  return {
    exerciseId: raw.exerciseId.trim(),
    setIndex: Math.floor(raw.setIndex as number),
    exerciseName: raw.exerciseName,
    setLabel: raw.setLabel,
    ...(setCount != null ? { setCount } : {}),
  }
}

export function normalizePersistedRestTimer(value: unknown): PersistedRestTimer | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<PersistedRestTimer>
  const target = sanitizeRestTarget(raw.target)
  if (!target) return null
  if (!Number.isFinite(raw.totalSec) || (raw.totalSec as number) <= 0) return null
  if (!Number.isFinite(raw.remainingSec) || (raw.remainingSec as number) < 0) return null
  if (!Number.isFinite(raw.endsAt) || (raw.endsAt as number) <= 0) return null
  return {
    totalSec: Math.round(raw.totalSec as number),
    remainingSec: Math.round(raw.remainingSec as number),
    endsAt: raw.endsAt as number,
    paused: raw.paused === true,
    target,
  }
}

export function remainingFromPersisted(
  snap: PersistedRestTimer,
  now = Date.now(),
): number {
  if (snap.paused) return Math.max(0, snap.remainingSec)
  return Math.max(0, Math.ceil((snap.endsAt - now) / 1000))
}
