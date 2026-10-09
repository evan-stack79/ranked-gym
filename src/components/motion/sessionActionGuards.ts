/**
 * Persist-first / idempotent guards for set validation and session finish.
 * Animation must never be the source of truth — commit first, then celebrate.
 */

export type SetLike = { done?: boolean }

/** True only when the set is still open and no other persist is in flight. */
export function canValidateSet(
  current: SetLike | undefined,
  options: { persistInFlight?: boolean } = {},
): boolean {
  if (!current) return false
  if (current.done) return false
  if (options.persistInFlight) return false
  return true
}

/** True only when a finish has not already started / completed. */
export function canFinishSession(options: {
  saving: boolean
  finishCommitted?: boolean
}): boolean {
  if (options.saving) return false
  if (options.finishCommitted) return false
  return true
}

/** Fixed celebration timings — identical for every session (no scaling by sets/load/goals). */
export const SESSION_COMPLETE_BURST_MS = 1000
export const SESSION_COMPLETE_REDUCED_MS = 0
export const SET_VALIDATED_POP_MS = 340
export const TAB_FADE_MS = 180
export const CARD_EXPAND_MS = 280
export const WAVE_ENTER_STAGGER_MS = 40
export const PROGRESS_FILL_MS = 360
