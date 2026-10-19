import { registerPlugin } from '@capacitor/core'
import { safeWarn } from '../utils/safeLog'

export type RestLiveActivityPayload = {
  remainingSec: number
  totalSec: number
  subtitle?: string
}

type RestTimerLiveActivityNative = {
  start: (options: RestLiveActivityPayload) => Promise<{ activityId?: string }>
  update: (options: { remainingSec: number; subtitle?: string }) => Promise<void>
  end: (options?: { immediate?: boolean }) => Promise<void>
  isAvailable: () => Promise<{ available: boolean }>
}

const RestTimerLiveActivityWeb: RestTimerLiveActivityNative = {
  async start() {
    return {}
  },
  async update() {},
  async end() {},
  async isAvailable() {
    return { available: false }
  },
}

/**
 * Pont Capacitor React → Swift (Dynamic Island / Live Activity).
 * JS name must match RestTimerLiveActivityPlugin.jsName ("RestTimerLiveActivity").
 */
const RestTimerLiveActivity = registerPlugin<RestTimerLiveActivityNative>('RestTimerLiveActivity', {
  web: () => RestTimerLiveActivityWeb,
})

let availabilityCache: boolean | null = null

export function isNativeIosShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor as
    | { getPlatform?: () => string; isNativePlatform?: () => boolean }
    | undefined
  if (!cap) return false
  if (cap.isNativePlatform?.() === false) return false
  const platform = cap.getPlatform?.()
  return platform === 'ios'
}

export async function isRestLiveActivityAvailable(): Promise<boolean> {
  if (availabilityCache != null) return availabilityCache
  if (!isNativeIosShell()) {
    availabilityCache = false
    return false
  }
  try {
    const { available } = await RestTimerLiveActivity.isAvailable()
    availabilityCache = available
    return available
  } catch {
    availabilityCache = false
    return false
  }
}

export async function startRestLiveActivity(payload: RestLiveActivityPayload): Promise<void> {
  if (!(await isRestLiveActivityAvailable())) return
  try {
    await RestTimerLiveActivity.start({
      remainingSec: Math.max(0, Math.round(payload.remainingSec)),
      totalSec: Math.max(1, Math.round(payload.totalSec)),
      subtitle: payload.subtitle ?? 'Repos en cours',
    })
  } catch (error) {
    safeWarn('[liveActivity] start failed', error)
  }
}

export async function updateRestLiveActivity(payload: {
  remainingSec: number
  subtitle?: string
}): Promise<void> {
  if (!(await isRestLiveActivityAvailable())) return
  try {
    await RestTimerLiveActivity.update({
      remainingSec: Math.max(0, Math.round(payload.remainingSec)),
      subtitle: payload.subtitle,
    })
  } catch (error) {
    safeWarn('[liveActivity] update failed', error)
  }
}

export async function endRestLiveActivity(immediate = true): Promise<void> {
  if (!isNativeIosShell()) return
  try {
    await RestTimerLiveActivity.end({ immediate })
  } catch (error) {
    safeWarn('[liveActivity] end failed', error)
  } finally {
    availabilityCache = null
  }
}
