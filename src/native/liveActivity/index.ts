import { registerPlugin } from '@capacitor/core'
import type {
  LiveActivityAvailability,
  LiveActivityNativeAction,
  LiveActivityPlugin,
  LiveActivitySessionPayload,
} from './types'
import { LiveActivityWeb } from './web'

export type {
  LiveActivityAvailability,
  LiveActivityNativeAction,
  LiveActivityPlugin,
  LiveActivitySessionPayload,
} from './types'
export { LiveActivityWeb } from './web'

/**
 * Bridge Capacitor typé.
 * iOS → RestTimerLiveActivityPlugin (ActivityKit).
 * Web / Android → stub no-op (pas d’erreur, pas de régression).
 */
const RestTimerLiveActivity = registerPlugin<LiveActivityPlugin>('RestTimerLiveActivity', {
  web: () => new LiveActivityWeb(),
})

export { RestTimerLiveActivity }

export function buildSessionId(routineId: string, startedAt: number): string {
  return `${routineId}:${startedAt}`
}

export function sanitizeLiveActivityPayload(
  input: LiveActivitySessionPayload,
): LiveActivitySessionPayload | null {
  const exerciseName = input.exerciseName?.trim()
  if (!exerciseName) return null
  if (!input.sessionId?.trim()) return null
  const setCurrent = Math.max(1, Math.floor(input.setCurrent || 1))
  const setTotal = Math.max(0, Math.floor(input.setTotal || 0))
  const restTotalSec = Math.max(0, Math.round(input.restTotalSec || 0))
  const paused = input.paused === true
  const pausedRemainingSec = Math.max(0, Math.round(input.pausedRemainingSec || 0))
  const sessionProgress = Math.min(1, Math.max(0, Number(input.sessionProgress) || 0))
  let restEndsAtMs: number | null = null
  if (
    !paused &&
    input.restEndsAtMs != null &&
    Number.isFinite(input.restEndsAtMs) &&
    (input.restEndsAtMs as number) > 0
  ) {
    restEndsAtMs = input.restEndsAtMs as number
  }
  return {
    sessionId: input.sessionId.trim(),
    exerciseName,
    setCurrent,
    setTotal,
    restEndsAtMs,
    restTotalSec,
    paused,
    pausedRemainingSec,
    sessionProgress,
  }
}

let availabilityCache: LiveActivityAvailability | null = null

export async function checkLiveActivityAvailability(): Promise<LiveActivityAvailability> {
  if (availabilityCache) return availabilityCache
  try {
    const result = await RestTimerLiveActivity.isAvailable()
    availabilityCache = {
      available: Boolean(result.available && result.authorized !== false),
      authorized: Boolean(result.authorized ?? result.available),
      platform: result.platform ?? 'web',
      supportsDynamicIsland: result.supportsDynamicIsland,
      supportsInteractive: result.supportsInteractive,
      reason: result.reason,
    }
    // Ne jamais afficher « dispo » si ActivityKit refusé.
    if (!availabilityCache.authorized) {
      availabilityCache = { ...availabilityCache, available: false }
    }
    return availabilityCache
  } catch {
    availabilityCache = {
      available: false,
      authorized: false,
      platform: 'web',
      reason: 'plugin_error',
    }
    return availabilityCache
  }
}

export function resetLiveActivityAvailabilityCache(): void {
  availabilityCache = null
}

export async function startLiveActivity(payload: LiveActivitySessionPayload): Promise<boolean> {
  const clean = sanitizeLiveActivityPayload(payload)
  if (!clean) return false
  const avail = await checkLiveActivityAvailability()
  if (!avail.available) return false
  try {
    const result = await RestTimerLiveActivity.start(clean)
    return Boolean(result.started)
  } catch {
    return false
  }
}

export async function updateLiveActivity(payload: LiveActivitySessionPayload): Promise<void> {
  const clean = sanitizeLiveActivityPayload(payload)
  if (!clean) return
  const avail = await checkLiveActivityAvailability()
  if (!avail.available) return
  try {
    await RestTimerLiveActivity.update(clean)
  } catch {
    // no-op
  }
}

export async function endLiveActivity(options?: {
  sessionId?: string
  immediate?: boolean
}): Promise<void> {
  try {
    await RestTimerLiveActivity.end({
      sessionId: options?.sessionId,
      immediate: options?.immediate ?? true,
    })
  } catch {
    // no-op
  } finally {
    availabilityCache = null
  }
}

export async function cleanupStaleLiveActivities(
  activeSessionId?: string | null,
): Promise<void> {
  try {
    await RestTimerLiveActivity.cleanupStale({
      activeSessionId: activeSessionId ?? undefined,
    })
  } catch {
    // no-op
  }
}

export async function drainPendingNativeActions(): Promise<LiveActivityNativeAction[]> {
  try {
    const { actions } = await RestTimerLiveActivity.pendingNativeActions()
    const list = Array.isArray(actions) ? actions : []
    if (list.length > 0) {
      await RestTimerLiveActivity.clearPendingActions({
        ids: list.map((a) => a.id),
      })
    }
    return list
  } catch {
    return []
  }
}

export async function consumePendingDeepLink(): Promise<string | null> {
  try {
    const { url } = await RestTimerLiveActivity.consumePendingDeepLink()
    return typeof url === 'string' && url.trim() ? url.trim() : null
  } catch {
    return null
  }
}

export type ParsedLiveActivityDeepLink =
  | { kind: 'session'; sessionId: string | null }
  | { kind: 'action'; action: string; sessionId: string; deltaSec?: number; token: string }
  | null

export function parseLiveActivityDeepLink(raw: string): ParsedLiveActivityDeepLink {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'rankedgym:') return null
  const host = (url.hostname || '').toLowerCase()
  const path = (url.pathname || '').toLowerCase()
  const params = url.searchParams

  if (host === 'session' || path.includes('/session')) {
    return { kind: 'session', sessionId: params.get('sessionId') }
  }
  if (host === 'live-activity' || path.includes('live-activity')) {
    const action = (params.get('action') || '').toLowerCase()
    if (!action) return null
    const deltaRaw = params.get('delta')
    const deltaSec = deltaRaw != null ? Number(deltaRaw) : undefined
    return {
      kind: 'action',
      action,
      sessionId: params.get('sessionId') || '',
      deltaSec: Number.isFinite(deltaSec) ? (deltaSec as number) : undefined,
      token: params.get('token') || `${action}:${Date.now()}`,
    }
  }
  return null
}
