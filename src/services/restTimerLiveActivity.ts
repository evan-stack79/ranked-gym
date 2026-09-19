/**
 * Pont Live Activity — source de vérité = activeWorkoutDraft + RestTimerContext.
 * Web/Android = no-op via stub registerPlugin.
 */
import {
  buildSessionId,
  checkLiveActivityAvailability,
  cleanupStaleLiveActivities,
  consumePendingDeepLink,
  drainPendingNativeActions,
  endLiveActivity,
  parseLiveActivityDeepLink,
  startLiveActivity,
  updateLiveActivity,
  type LiveActivitySessionPayload,
} from '../native/liveActivity'
import { getTrainingState } from './trainingStorage'
import { safeWarn } from '../utils/safeLog'

export type RestLiveActivityPayload = {
  remainingSec: number
  totalSec: number
  subtitle?: string
  exerciseName?: string
  setCurrent?: number
  setTotal?: number
  restEndsAtMs?: number | null
  paused?: boolean
  sessionProgress?: number
}

export { buildSessionId }
export {
  checkLiveActivityAvailability as isRestLiveActivityAvailableDetailed,
  parseLiveActivityDeepLink,
  drainPendingNativeActions,
  consumePendingDeepLink,
  cleanupStaleLiveActivities,
}

function activeSessionId(): string | null {
  const draft = getTrainingState().activeWorkoutDraft
  if (!draft) return null
  return buildSessionId(draft.routineId, draft.startedAt)
}

function parseSubtitle(subtitle?: string): {
  exerciseName: string
  setCurrent: number
  setTotal: number
} {
  const raw = (subtitle ?? '').trim()
  if (!raw) return { exerciseName: 'Exercice', setCurrent: 1, setTotal: 0 }
  const parts = raw.split('·').map((p) => p.trim())
  const exerciseName = parts[0] || 'Exercice'
  const setPart = parts[1] || ''
  const slash = setPart.match(/(\d+)\s*[\/sur]+(?:\s*)(\d+)/i)
  if (slash) {
    return {
      exerciseName,
      setCurrent: Math.max(1, Number(slash[1])),
      setTotal: Math.max(0, Number(slash[2])),
    }
  }
  const single = setPart.match(/(\d+)/)
  return {
    exerciseName,
    setCurrent: single ? Math.max(1, Number(single[1])) : 1,
    setTotal: 0,
  }
}

function toPayload(input: RestLiveActivityPayload): LiveActivitySessionPayload | null {
  const sessionId = activeSessionId()
  if (!sessionId) return null
  const parsed = parseSubtitle(input.subtitle)
  const exerciseName = (input.exerciseName ?? parsed.exerciseName).trim()
  if (!exerciseName) return null
  const paused = input.paused === true
  const remaining = Math.max(0, Math.round(input.remainingSec))
  const total = Math.max(1, Math.round(input.totalSec || remaining || 1))
  let restEndsAtMs: number | null =
    input.restEndsAtMs != null && Number.isFinite(input.restEndsAtMs)
      ? (input.restEndsAtMs as number)
      : null
  if (!paused && restEndsAtMs == null && remaining > 0) {
    restEndsAtMs = Date.now() + remaining * 1000
  }
  return {
    sessionId,
    exerciseName,
    setCurrent: input.setCurrent ?? parsed.setCurrent,
    setTotal: input.setTotal ?? parsed.setTotal,
    restEndsAtMs: paused ? null : restEndsAtMs,
    restTotalSec: total,
    paused,
    pausedRemainingSec: paused ? remaining : remaining,
    sessionProgress: Math.min(1, Math.max(0, input.sessionProgress ?? 0)),
  }
}

export async function isRestLiveActivityAvailable(): Promise<boolean> {
  const a = await checkLiveActivityAvailability()
  return a.available
}

export function isNativeIosShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (
    window as Window & {
      Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean }
    }
  ).Capacitor
  if (!cap) return false
  if (cap.isNativePlatform?.() === false) return false
  return cap.getPlatform?.() === 'ios'
}

export async function startRestLiveActivity(payload: RestLiveActivityPayload): Promise<void> {
  const next = toPayload(payload)
  if (!next) return
  try {
    await startLiveActivity(next)
  } catch (error) {
    safeWarn('[liveActivity] start failed', error)
  }
}

export async function updateRestLiveActivity(payload: {
  remainingSec: number
  subtitle?: string
  exerciseName?: string
  setCurrent?: number
  setTotal?: number
  restEndsAtMs?: number | null
  paused?: boolean
  totalSec?: number
  sessionProgress?: number
}): Promise<void> {
  const next = toPayload({
    remainingSec: payload.remainingSec,
    totalSec: payload.totalSec ?? payload.remainingSec,
    subtitle: payload.subtitle,
    exerciseName: payload.exerciseName,
    setCurrent: payload.setCurrent,
    setTotal: payload.setTotal,
    restEndsAtMs: payload.restEndsAtMs,
    paused: payload.paused,
    sessionProgress: payload.sessionProgress,
  })
  if (!next) return
  try {
    await updateLiveActivity(next)
  } catch (error) {
    safeWarn('[liveActivity] update failed', error)
  }
}

export async function endRestLiveActivity(immediate = true): Promise<void> {
  try {
    await endLiveActivity({
      sessionId: activeSessionId() ?? undefined,
      immediate,
    })
  } catch (error) {
    safeWarn('[liveActivity] end failed', error)
  }
}

/** Au launch / restore : tue les LA d’anciennes séances. */
export async function reconcileLiveActivityOnLaunch(): Promise<void> {
  try {
    await cleanupStaleLiveActivities(activeSessionId())
  } catch (error) {
    safeWarn('[liveActivity] cleanup failed', error)
  }
}
