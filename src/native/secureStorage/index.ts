import type { SecureStoragePlugin } from './types'
import { SecureStorageWeb } from './web'

export type { SecureStoragePlugin, SecureStorageGetResult } from './types'
export { SecureStorageWeb }

type CapacitorBridge = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  isPluginAvailable?: (name: string) => boolean
  Plugins?: {
    SecureStorage?: SecureStoragePlugin
  }
}

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null
  return (
    window as Window & {
      Capacitor?: CapacitorBridge
    }
  ).Capacitor ?? null
}

let bound: SecureStoragePlugin | null = null

function activePlugin(): SecureStoragePlugin | null {
  return bound ?? getCapacitor()?.Plugins?.SecureStorage ?? null
}

/**
 * Optional Capacitor proxy. Dynamic import so Node tests that never boot
 * the app do not hard-fail when resolving `@capacitor/core`.
 */
export async function bindSecureStoragePlugin(): Promise<void> {
  if (bound) return
  try {
    const { registerPlugin } = await import('@capacitor/core')
    bound = registerPlugin<SecureStoragePlugin>('SecureStorage', {
      web: () => new SecureStorageWeb(),
    })
  } catch {
    bound = null
  }
}

export const SecureStorage: SecureStoragePlugin = {
  get: (options) => {
    const plugin = activePlugin()
    if (!plugin) return Promise.resolve({ value: null })
    return plugin.get(options)
  },
  set: (options) => {
    const plugin = activePlugin()
    if (!plugin) return Promise.resolve()
    return plugin.set(options)
  },
  remove: (options) => {
    const plugin = activePlugin()
    if (!plugin) return Promise.resolve()
    return plugin.remove(options)
  },
}

export function isNativeSecureStorageAvailable(): boolean {
  const cap = getCapacitor()
  if (!cap) return false
  const platform = cap.getPlatform?.()
  const native =
    cap.isNativePlatform?.() === true || platform === 'ios' || platform === 'android'
  if (!native) return false
  // Prefer Keychain only when the native plugin is actually registered.
  // Otherwise login hard-fails with: "SecureStorage" plugin is not implemented on ios.
  if (typeof cap.isPluginAvailable === 'function') {
    return cap.isPluginAvailable('SecureStorage')
  }
  return Boolean(cap.Plugins?.SecureStorage)
}

export function resetSecureStorageBindingForTests(): void {
  bound = null
}
