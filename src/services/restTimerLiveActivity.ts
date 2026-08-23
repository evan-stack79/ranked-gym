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

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
      Plugins?: {
        RestTimerLiveActivity?: RestTimerLiveActivityNative
      }
    }
  }
}

let availabilityCache: boolean | null = null

function getNativePlugin(): RestTimerLiveActivityNative | null {
  if (typeof window === 'undefined') return null
  return window.Capacitor?.Plugins?.RestTimerLiveActivity ?? null
}

export function isNativeIosShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (!cap) return false
  if (cap.isNativePlatform?.() === false) return false
  const platform = cap.getPlatform?.()
  return platform === 'ios'
}

export async function isRestLiveActivityAvailable(): Promise<boolean> {
  if (availabilityCache != null) return availabilityCache
  const plugin = getNativePlugin()
  if (!plugin) {
    availabilityCache = false
    return false
  }
  try {
    const { available } = await plugin.isAvailable()
    availabilityCache = available
    return available
  } catch {
    availabilityCache = false
    return false
  }
}

export async function startRestLiveActivity(payload: RestLiveActivityPayload): Promise<void> {
  const plugin = getNativePlugin()
  if (!plugin || !(await isRestLiveActivityAvailable())) return
  try {
    await plugin.start({
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
  const plugin = getNativePlugin()
  if (!plugin || !(await isRestLiveActivityAvailable())) return
  try {
    await plugin.update({
      remainingSec: Math.max(0, Math.round(payload.remainingSec)),
      subtitle: payload.subtitle,
    })
  } catch (error) {
    safeWarn('[liveActivity] update failed', error)
  }
}

export async function endRestLiveActivity(immediate = true): Promise<void> {
  const plugin = getNativePlugin()
  if (!plugin) return
  try {
    await plugin.end({ immediate })
  } catch (error) {
    safeWarn('[liveActivity] end failed', error)
  } finally {
    availabilityCache = null
  }
}
