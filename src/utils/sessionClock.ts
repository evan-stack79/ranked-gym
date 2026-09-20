/**
 * Chronomètre de séance Train — durée réelle vs estimation.
 * Champs optionnels sur ActiveWorkoutDraft (rétrocompatibles).
 */
import type { ActiveWorkoutDraft } from '../types/training'

/** Présence d’au moins un champ clock → brouillon post-Train-V2. */
export function hasDraftClockFields(draft: ActiveWorkoutDraft): boolean {
  return (
    draft.elapsedActiveMs !== undefined ||
    draft.runningSince !== undefined ||
    draft.paused !== undefined
  )
}

export function liveElapsedMs(draft: ActiveWorkoutDraft | null | undefined, now = Date.now()): number {
  if (!draft) return 0
  const base = Number.isFinite(draft.elapsedActiveMs) ? Math.max(0, draft.elapsedActiveMs!) : 0
  if (draft.paused) return base
  const since = draft.runningSince
  if (since == null || !Number.isFinite(since) || since <= 0) return base
  return base + Math.max(0, now - since)
}

export function liveElapsedMin(draft: ActiveWorkoutDraft | null | undefined, now = Date.now()): number {
  const ms = liveElapsedMs(draft, now)
  if (ms <= 0) return 0
  return Math.max(1, Math.round(ms / 60_000))
}

/** Estimation legacy (minutes) — jamais inventée si absente. */
export function estimatedElapsedMin(
  draft: ActiveWorkoutDraft | null | undefined,
): number {
  if (!draft || !Number.isFinite(draft.estimatedElapsedMs) || draft.estimatedElapsedMs! <= 0) {
    return 0
  }
  return Math.max(1, Math.round(draft.estimatedElapsedMs! / 60_000))
}

/**
 * Durée à afficher / sauver : chronomètre réel prioritaire ;
 * sinon estimation legacy figée ; sinon 0 (pas d’invention).
 */
export function resolvedDurationMin(
  draft: ActiveWorkoutDraft | null | undefined,
  now = Date.now(),
): number {
  const live = liveElapsedMin(draft, now)
  if (live > 0) return live
  return estimatedElapsedMin(draft)
}

export function formatSessionClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Pause : fige le temps accumulé. */
export function pauseDraftClock(draft: ActiveWorkoutDraft, now = Date.now()): ActiveWorkoutDraft {
  if (draft.paused) return draft
  const elapsedActiveMs = liveElapsedMs(draft, now)
  return {
    ...draft,
    elapsedActiveMs,
    runningSince: null,
    paused: true,
    updatedAt: now,
  }
}

/** Reprise : démarre un nouveau segment. */
export function resumeDraftClock(draft: ActiveWorkoutDraft, now = Date.now()): ActiveWorkoutDraft {
  const elapsedActiveMs = Number.isFinite(draft.elapsedActiveMs)
    ? Math.max(0, draft.elapsedActiveMs!)
    : liveElapsedMs({ ...draft, paused: true }, now)
  return {
    ...draft,
    elapsedActiveMs,
    runningSince: now,
    paused: false,
    updatedAt: now,
  }
}

/**
 * Bootstrap chronomètre.
 * Legacy sans champs clock : mesure à partir de `now` (reprise) ;
 * `startedAt` → estimation figée uniquement (jamais durée chronométrée).
 */
export function ensureDraftClock(draft: ActiveWorkoutDraft, now = Date.now()): ActiveWorkoutDraft {
  if (!hasDraftClockFields(draft)) {
    const estimated =
      Number.isFinite(draft.estimatedElapsedMs) && draft.estimatedElapsedMs! >= 0
        ? draft.estimatedElapsedMs!
        : Number.isFinite(draft.startedAt) && draft.startedAt > 0
          ? Math.max(0, now - draft.startedAt)
          : 0
    return {
      ...draft,
      estimatedElapsedMs: estimated,
      elapsedActiveMs: 0,
      runningSince: now,
      paused: false,
    }
  }

  if (draft.paused === true) {
    return {
      ...draft,
      elapsedActiveMs: Number.isFinite(draft.elapsedActiveMs) ? Math.max(0, draft.elapsedActiveMs!) : 0,
      runningSince: null,
    }
  }
  if (draft.runningSince != null && Number.isFinite(draft.runningSince)) {
    return {
      ...draft,
      elapsedActiveMs: Number.isFinite(draft.elapsedActiveMs) ? Math.max(0, draft.elapsedActiveMs!) : 0,
      paused: false,
    }
  }
  // Champs partiels (ex. elapsed seul) : démarre un segment maintenant
  return {
    ...draft,
    elapsedActiveMs: Number.isFinite(draft.elapsedActiveMs) ? Math.max(0, draft.elapsedActiveMs!) : 0,
    runningSince: now,
    paused: false,
  }
}
