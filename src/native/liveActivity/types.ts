export type LiveActivityAvailability = {
  available: boolean
  authorized: boolean
  platform: 'ios' | 'android' | 'web'
  supportsDynamicIsland?: boolean
  supportsInteractive?: boolean
  reason?: string
}

/** Payload minimal ActivityKit — champs réels de la séance, jamais hardcodés. */
export type LiveActivitySessionPayload = {
  /** `routineId:startedAt` */
  sessionId: string
  exerciseName: string
  /** 1-based */
  setCurrent: number
  setTotal: number
  /** Epoch ms ; absent si pas de repos / pause */
  restEndsAtMs?: number | null
  restTotalSec: number
  paused: boolean
  pausedRemainingSec: number
  /** 0…1 progression exercices */
  sessionProgress: number
}

export type LiveActivityNativeAction = {
  id: string
  type: 'adjust' | 'pause' | 'resume' | 'togglePause' | string
  sessionId: string
  createdAtMs: number
  deltaSec?: number
}

export type LiveActivityPlugin = {
  isAvailable: () => Promise<LiveActivityAvailability>
  start: (
    options: LiveActivitySessionPayload,
  ) => Promise<{ started?: boolean; activityId?: string; reason?: string }>
  update: (options: LiveActivitySessionPayload) => Promise<void>
  end: (options?: { sessionId?: string; immediate?: boolean }) => Promise<void>
  cleanupStale: (options?: {
    activeSessionId?: string | null
  }) => Promise<{ cleaned?: boolean | number }>
  pendingNativeActions: () => Promise<{ actions: LiveActivityNativeAction[] }>
  clearPendingActions: (options?: { ids?: string[] }) => Promise<void>
  consumePendingDeepLink: () => Promise<{ url?: string | null }>
}
