import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isNativeSecureStorageAvailable,
  resetSecureStorageBindingForTests,
} from './index'

describe('isNativeSecureStorageAvailable', () => {
  beforeEach(() => {
    resetSecureStorageBindingForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetSecureStorageBindingForTests()
  })

  it('returns false when Capacitor is missing', () => {
    vi.stubGlobal('window', {})
    expect(isNativeSecureStorageAvailable()).toBe(false)
  })

  it('returns false on native iOS when SecureStorage is not registered', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        isPluginAvailable: (name: string) => name !== 'SecureStorage',
      },
    })
    expect(isNativeSecureStorageAvailable()).toBe(false)
  })

  it('returns true on native iOS when SecureStorage plugin header is present', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        isPluginAvailable: (name: string) => name === 'SecureStorage',
      },
    })
    expect(isNativeSecureStorageAvailable()).toBe(true)
  })

  it('falls back to Plugins map when isPluginAvailable is absent', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
        Plugins: {
          SecureStorage: {
            get: async () => ({ value: null }),
            set: async () => {},
            remove: async () => {},
          },
        },
      },
    })
    expect(isNativeSecureStorageAvailable()).toBe(true)
  })
})
