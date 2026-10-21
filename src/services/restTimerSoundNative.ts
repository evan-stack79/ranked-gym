import { Capacitor, registerPlugin } from '@capacitor/core'
import { safeWarn } from '../utils/safeLog'

export type RestTimerSoundScheduleOptions = {
  endAtMs: number
  soundEnabled: boolean
  token: string
}

type RestTimerSoundNative = {
  schedule: (
    options: RestTimerSoundScheduleOptions,
  ) => Promise<{ scheduled?: boolean; permission?: boolean }>
  cancel: () => Promise<void>
  preview: () => Promise<void>
  playNow: (options?: {
    token?: string
    cancelPending?: boolean
  }) => Promise<{ played?: boolean; reason?: string }>
  vibrate: () => Promise<void>
}

const webTimers = new Map<string, number>()

const RestTimerSoundWeb: RestTimerSoundNative = {
  async schedule(options) {
    const delay = Math.max(0, options.endAtMs - Date.now())
    const existing = webTimers.get('end')
    if (existing != null) window.clearTimeout(existing)
    // Web: no lock-screen notification — foreground timeout only.
    const id = window.setTimeout(() => {
      webTimers.delete('end')
    }, delay)
    webTimers.set('end', id)
    return { scheduled: true, permission: true }
  },
  async cancel() {
    const id = webTimers.get('end')
    if (id != null) window.clearTimeout(id)
    webTimers.clear()
  },
  async preview() {},
  async playNow() {
    return { played: true }
  },
  async vibrate() {},
}

const RestTimerSound = registerPlugin<RestTimerSoundNative>('RestTimerSound', {
  web: () => RestTimerSoundWeb,
})

export function isRestTimerSoundNativeIos(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}

export async function nativeSchedule(
  options: RestTimerSoundScheduleOptions,
): Promise<{ scheduled?: boolean; permission?: boolean }> {
  try {
    return await RestTimerSound.schedule(options)
  } catch (error) {
    safeWarn('[restTimerSound] schedule failed', error)
    return { scheduled: false }
  }
}

export async function nativeCancel(): Promise<void> {
  try {
    await RestTimerSound.cancel()
  } catch (error) {
    safeWarn('[restTimerSound] cancel failed', error)
  }
}

export async function nativePreview(): Promise<void> {
  try {
    await RestTimerSound.preview()
  } catch (error) {
    safeWarn('[restTimerSound] preview failed', error)
  }
}

export async function nativePlayNow(
  token?: string,
  opts?: { cancelPending?: boolean },
): Promise<{ played: boolean }> {
  try {
    const res = await RestTimerSound.playNow({
      token,
      cancelPending: opts?.cancelPending ?? true,
    })
    return { played: res.played !== false }
  } catch (error) {
    safeWarn('[restTimerSound] playNow failed', error)
    return { played: false }
  }
}

export async function nativeVibrate(): Promise<void> {
  try {
    await RestTimerSound.vibrate()
  } catch (error) {
    safeWarn('[restTimerSound] vibrate failed', error)
  }
}

/** Test seam — clear web timeouts. */
export function __resetRestTimerSoundNativeWebForTests(): void {
  for (const id of webTimers.values()) window.clearTimeout(id)
  webTimers.clear()
}
