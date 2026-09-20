import type { SecureStoragePlugin, SecureStorageGetResult } from './types'

/**
 * Web stub — Keystore/Keychain n’existent pas dans le navigateur.
 * Le JS n’utilise ce plugin que si `Capacitor.isNativePlatform()` est vrai.
 */
export class SecureStorageWeb implements SecureStoragePlugin {
  async get(_options: { key: string }): Promise<SecureStorageGetResult> {
    return { value: null }
  }

  async set(_options: { key: string; value: string }): Promise<void> {
    /* web: no-op */
  }

  async remove(_options: { key: string }): Promise<void> {
    /* web: no-op */
  }
}
