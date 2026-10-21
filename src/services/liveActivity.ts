/**
 * Pont Capacitor → LiveActivityPlugin (Dynamic Island / écran verrouillé).
 * Kinds: rest | session | steps | record | rank
 * Une seule activité séance+repos (reuseIfPresent / update kind).
 * Interdits: pouls, poids corps, calories, perte de poids.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { isMinorOrUnknownAge } from './nutritionSafetyRules'
import { safeWarn } from '../utils/safeLog'

export type LiveActivityKind = 'rest' | 'session' | 'steps' | 'record' | 'rank'

export type LiveActivityPayload = {
  kind: LiveActivityKind
  activityToken?: string
  /** When true, update the current activity instead of ending+starting. */
  reuseIfPresent?: boolean
  /** Snapshot seconds (pause / fallback). Not ticked into the island. */
  remainingSec?: number
  totalSec?: number
  paused?: boolean
  /**
   * Wall-clock rest window start (epoch ms). Widget ProgressView/Text use
   * `timerInterval: startDate...endDate`. 0 when paused / N/A.
   */
  startDateMs?: number
  /**
   * Wall-clock rest end (epoch ms). Native `staleDate` = this value.
   * 0 when paused / N/A — never updated every second.
   */
  endDateMs?: number
  exerciseName?: string
  setIndex?: number
  setTotal?: number
  weightKg?: number
  reps?: number
  startedAtMs?: number
  steps?: number
  /** User-chosen goal only — never a health prescription. */
  stepsGoal?: number
  alertTitle?: string
  alertBody?: string
  subtitle?: string
}

type LiveActivityNative = {
  start: (
    options: LiveActivityPayload,
  ) => Promise<{ activityId?: string; reused?: boolean }>
  update: (options: Partial<LiveActivityPayload>) => Promise<{ updated?: boolean }>
  end: (options?: { immediate?: boolean }) => Promise<void>
  isAvailable: () => Promise<{ available: boolean }>
  alert: (options: {
    kind: 'record' | 'rank'
    alertTitle: string
    alertBody: string
  }) => Promise<{ alerted?: boolean }>
  addListener?: (
    eventName: string,
    listener: (data: { action?: string }) => void,
  ) => Promise<{ remove: () => void }>
}

const LiveActivityWeb: LiveActivityNative = {
  async start() {
    return {}
  },
  async update() {
    return { updated: false }
  },
  async end() {},
  async isAvailable() {
    return { available: false }
  },
  async alert() {
    return { alerted: false }
  },
  async addListener() {
    return { remove: () => {} }
  },
}

const LiveActivity = registerPlugin<LiveActivityNative>('LiveActivity', {
  web: () => LiveActivityWeb,
})

let availabilityCache: boolean | null = null

/** Session token — rest reuses the same native activity. */
const SESSION_TOKEN = 'ranked-gym.session'
const STEPS_TOKEN = 'ranked-gym.steps'

type BridgeState = {
  sessionActive: boolean
  sessionSnapshot: LiveActivityPayload | null
  restActive: boolean
  stepsActive: boolean
}

const bridge: BridgeState = {
  sessionActive: false,
  sessionSnapshot: null,
  restActive: false,
  stepsActive: false,
}

/** Test seam */
export function __resetLiveActivityBridgeForTests(): void {
  availabilityCache = null
  bridge.sessionActive = false
  bridge.sessionSnapshot = null
  bridge.restActive = false
  bridge.stepsActive = false
}

export function __getLiveActivityBridgeStateForTests(): BridgeState {
  return { ...bridge, sessionSnapshot: bridge.sessionSnapshot }
}

export function isNativeIosShell(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}

export async function isLiveActivityAvailable(): Promise<boolean> {
  if (availabilityCache != null) return availabilityCache
  if (!isNativeIosShell()) {
    availabilityCache = false
    return false
  }
  try {
    const { available } = await LiveActivity.isAvailable()
    availabilityCache = available
    return available
  } catch {
    availabilityCache = false
    return false
  }
}

async function nativeStart(payload: LiveActivityPayload): Promise<void> {
  if (!(await isLiveActivityAvailable())) return
  try {
    await LiveActivity.start(payload)
  } catch (error) {
    safeWarn('[liveActivity] start failed', error)
  }
}

async function nativeUpdate(payload: Partial<LiveActivityPayload>): Promise<void> {
  if (!(await isLiveActivityAvailable())) return
  try {
    await LiveActivity.update(payload)
  } catch (error) {
    safeWarn('[liveActivity] update failed', error)
  }
}

async function nativeEnd(immediate = true): Promise<void> {
  if (!isNativeIosShell()) return
  try {
    await LiveActivity.end({ immediate })
  } catch (error) {
    safeWarn('[liveActivity] end failed', error)
  } finally {
    availabilityCache = null
  }
}

async function nativeAlert(options: {
  kind: 'record' | 'rank'
  alertTitle: string
  alertBody: string
}): Promise<void> {
  if (!(await isLiveActivityAvailable())) return
  try {
    await LiveActivity.alert(options)
  } catch (error) {
    safeWarn('[liveActivity] alert failed', error)
  }
}

// ── Rest ────────────────────────────────────────────────────────────────────

/**
 * Mirrors native `LiveActivityPlugin.staleDate(for:)`:
 * rest + running + endDateMs > 0 → staleDate == endDateMs; else null.
 */
export function restLiveActivityStaleDateMs(opts: {
  kind?: string
  endDateMs?: number
  paused?: boolean
}): number | null {
  if ((opts.kind ?? 'rest') !== 'rest') return null
  if (opts.paused) return null
  const end = opts.endDateMs ?? 0
  return end > 0 ? end : null
}

/** Build start/end wall-clock ms for ProgressView/Text(timerInterval:). */
export function restLiveActivityWindowMs(opts: {
  endDateMs: number
  totalSec: number
  startDateMs?: number
  paused?: boolean
}): { startDateMs: number; endDateMs: number } | null {
  if (opts.paused) return null
  const endDateMs = Math.max(0, Math.round(opts.endDateMs))
  if (endDateMs <= 0) return null
  const totalMs = Math.max(1, Math.round(opts.totalSec)) * 1000
  const startDateMs =
    opts.startDateMs != null && opts.startDateMs > 0
      ? Math.round(opts.startDateMs)
      : endDateMs - totalMs
  return { startDateMs, endDateMs }
}

export async function startRestLiveActivity(payload: {
  remainingSec: number
  totalSec: number
  /** Wall-clock end; required when not paused so the island ticks offline. */
  endDateMs?: number
  /** Wall-clock start of this rest window (defaults to end − total). */
  startDateMs?: number
  subtitle?: string
  paused?: boolean
  /** Next set (1-based) for « Série X sur Y ensuite ». */
  setIndex?: number
  setTotal?: number
  exerciseName?: string
}): Promise<void> {
  const paused = payload.paused ?? false
  const totalSec = Math.max(1, Math.round(payload.totalSec))
  const window = restLiveActivityWindowMs({
    endDateMs: payload.endDateMs ?? 0,
    totalSec,
    startDateMs: payload.startDateMs,
    paused,
  })
  const nextSet =
    payload.setIndex != null
      ? Math.max(1, Math.round(payload.setIndex))
      : Math.max(1, (bridge.sessionSnapshot?.setIndex ?? 0) + 1)
  const setTotal = Math.max(
    nextSet,
    payload.setTotal != null
      ? Math.round(payload.setTotal)
      : (bridge.sessionSnapshot?.setTotal ?? nextSet),
  )
  const exerciseName =
    payload.exerciseName?.trim() || bridge.sessionSnapshot?.exerciseName || ''
  const body: LiveActivityPayload = {
    kind: 'rest',
    activityToken: SESSION_TOKEN,
    remainingSec: Math.max(0, Math.round(payload.remainingSec)),
    totalSec,
    startDateMs: window?.startDateMs ?? 0,
    endDateMs: window?.endDateMs ?? 0,
    setIndex: nextSet,
    setTotal,
    exerciseName,
    subtitle: payload.subtitle ?? 'Repos en cours',
    paused,
    reuseIfPresent: bridge.sessionActive,
  }
  bridge.restActive = true
  if (bridge.sessionActive) {
    await nativeStart(body) // reuseIfPresent → update
    return
  }
  await nativeStart(body)
}

export async function updateRestLiveActivity(payload: {
  remainingSec?: number
  startDateMs?: number
  endDateMs?: number
  subtitle?: string
  paused?: boolean
  totalSec?: number
}): Promise<void> {
  if (!bridge.restActive && !bridge.sessionActive) return
  const paused = payload.paused
  let startDateMs: number | undefined
  let endDateMs: number | undefined
  if (paused === true) {
    startDateMs = 0
    endDateMs = 0
  } else if (payload.endDateMs != null) {
    const totalSec = payload.totalSec != null ? Math.max(1, Math.round(payload.totalSec)) : 1
    const window = restLiveActivityWindowMs({
      endDateMs: payload.endDateMs,
      totalSec:
        payload.remainingSec != null ? Math.max(1, Math.round(payload.remainingSec)) : totalSec,
      startDateMs: payload.startDateMs,
      paused: false,
    })
    startDateMs = window?.startDateMs
    endDateMs = window?.endDateMs
  }
  await nativeUpdate({
    kind: 'rest',
    remainingSec:
      payload.remainingSec != null ? Math.max(0, Math.round(payload.remainingSec)) : undefined,
    startDateMs,
    endDateMs,
    subtitle: payload.subtitle,
    paused,
    totalSec: payload.totalSec != null ? Math.max(1, Math.round(payload.totalSec)) : undefined,
  })
}

export async function endRestLiveActivity(immediate = true): Promise<void> {
  bridge.restActive = false
  if (bridge.sessionActive && bridge.sessionSnapshot) {
    // Back to session mode — never a second activity.
    await nativeStart({
      ...bridge.sessionSnapshot,
      kind: 'session',
      activityToken: SESSION_TOKEN,
      reuseIfPresent: true,
    })
    return
  }
  if (!bridge.sessionActive) {
    await nativeEnd(immediate)
  }
}

// ── Session ─────────────────────────────────────────────────────────────────

export async function startSessionLiveActivity(payload: {
  exerciseName: string
  setIndex: number
  setTotal: number
  weightKg: number
  reps: number
  startedAtMs: number
  subtitle?: string
}): Promise<void> {
  const body: LiveActivityPayload = {
    kind: 'session',
    activityToken: SESSION_TOKEN,
    exerciseName: payload.exerciseName,
    setIndex: Math.max(1, Math.round(payload.setIndex)),
    setTotal: Math.max(1, Math.round(payload.setTotal)),
    weightKg: payload.weightKg,
    reps: Math.max(0, Math.round(payload.reps)),
    startedAtMs: payload.startedAtMs,
    subtitle: payload.subtitle ?? '',
    reuseIfPresent: bridge.sessionActive || bridge.restActive,
  }
  bridge.sessionActive = true
  bridge.sessionSnapshot = body
  await nativeStart(body)
}

export async function updateSessionLiveActivity(payload: {
  exerciseName?: string
  setIndex?: number
  setTotal?: number
  weightKg?: number
  reps?: number
  subtitle?: string
}): Promise<void> {
  if (!bridge.sessionActive) return
  const next: LiveActivityPayload = {
    ...(bridge.sessionSnapshot ?? { kind: 'session' as const }),
    kind: 'session',
    ...payload,
    setIndex: payload.setIndex != null ? Math.max(1, Math.round(payload.setIndex)) : bridge.sessionSnapshot?.setIndex,
    setTotal: payload.setTotal != null ? Math.max(1, Math.round(payload.setTotal)) : bridge.sessionSnapshot?.setTotal,
    reps: payload.reps != null ? Math.max(0, Math.round(payload.reps)) : bridge.sessionSnapshot?.reps,
  }
  bridge.sessionSnapshot = next
  if (bridge.restActive) {
    // Keep rest UI while resting; snapshot updated for return.
    return
  }
  await nativeUpdate(next)
}

export async function endSessionLiveActivity(immediate = true): Promise<void> {
  bridge.sessionActive = false
  bridge.sessionSnapshot = null
  bridge.restActive = false
  await nativeEnd(immediate)
}

// ── Steps (user-chosen goal) ────────────────────────────────────────────────

export async function startOrUpdateStepsLiveActivity(payload: {
  steps: number
  stepsGoal: number
}): Promise<void> {
  const goal = Math.max(0, Math.round(payload.stepsGoal))
  const steps = Math.max(0, Math.round(payload.steps))
  // Never invent a health target — require an explicit user goal.
  if (goal <= 0) {
    if (bridge.stepsActive) {
      bridge.stepsActive = false
      // Don't kill session/rest activity.
      if (!bridge.sessionActive && !bridge.restActive) await nativeEnd(true)
    }
    return
  }
  const body: LiveActivityPayload = {
    kind: 'steps',
    activityToken: STEPS_TOKEN,
    steps,
    stepsGoal: goal,
    subtitle: 'Objectif choisi',
    reuseIfPresent: bridge.stepsActive,
  }
  // Steps is a separate lightweight activity only when no session/rest.
  if (bridge.sessionActive || bridge.restActive) return
  bridge.stepsActive = true
  await nativeStart(body)
}

export async function endStepsLiveActivity(immediate = true): Promise<void> {
  if (!bridge.stepsActive) return
  bridge.stepsActive = false
  if (!bridge.sessionActive && !bridge.restActive) await nativeEnd(immediate)
}

// ── Record / rank alerts ────────────────────────────────────────────────────

export async function showRecordLiveAlert(payload: {
  alertTitle: string
  alertBody: string
}): Promise<void> {
  if (!bridge.sessionActive) return
  await nativeAlert({
    kind: 'record',
    alertTitle: payload.alertTitle,
    alertBody: payload.alertBody,
  })
  // Revert to session after a short beat (JS timer — native alert is immediate).
  window.setTimeout(() => {
    if (bridge.sessionActive && bridge.sessionSnapshot && !bridge.restActive) {
      void nativeUpdate({ ...bridge.sessionSnapshot, kind: 'session' })
    }
  }, 4000)
}

/**
 * Rank-up alert. Rank is derived from workouts only.
 * Under 18 / unknown age: never show ranking / comparison to others.
 */
export async function showRankLiveAlert(payload: {
  alertTitle: string
  alertBody: string
  age: number | null | undefined
}): Promise<boolean> {
  // 0 / négatif / NaN / null / < 18 → jamais de classement
  if (isMinorOrUnknownAge(payload.age)) {
    return false
  }
  if (!bridge.sessionActive) return false
  await nativeAlert({
    kind: 'rank',
    alertTitle: payload.alertTitle,
    alertBody: payload.alertBody,
  })
  window.setTimeout(() => {
    if (bridge.sessionActive && bridge.sessionSnapshot && !bridge.restActive) {
      void nativeUpdate({ ...bridge.sessionSnapshot, kind: 'session' })
    }
  }, 5000)
  return true
}

export type LiveActivityAction = 'pause' | 'stop' | 'validate' | 'add15'

/**
 * Subscribe to widget App Intent actions (Darwin → Capacitor `liveAction`).
 */
export async function subscribeLiveActivityActions(
  onAction: (action: LiveActivityAction) => void,
): Promise<{ remove: () => void }> {
  if (!isNativeIosShell()) {
    return { remove: () => {} }
  }
  try {
    const handle = await LiveActivity.addListener?.('liveAction', (data) => {
      const action = data?.action
      if (
        action === 'pause' ||
        action === 'stop' ||
        action === 'validate' ||
        action === 'add15'
      ) {
        onAction(action)
      }
    })
    return handle ?? { remove: () => {} }
  } catch (error) {
    safeWarn('[liveActivity] subscribe liveAction failed', error)
    return { remove: () => {} }
  }
}

/** @deprecated — use isLiveActivityAvailable */
export const isRestLiveActivityAvailable = isLiveActivityAvailable
