/**
 * Stockage auth — Keystore/Keychain dans le shell Capacitor, sinon AES-GCM web.
 *
 * Native : tokens et secret appareil ne restent pas en localStorage WebView.
 * Web/PWA : ciphertext localStorage + secret appareil en clair dans localStorage.
 * Ce n’est pas un Keystore ; XSS ou dump du profil navigateur suffit.
 */
import type { SupportedStorage } from '@supabase/supabase-js'
import { SecureStorage, bindSecureStoragePlugin, isNativeSecureStorageAvailable } from '../native/secureStorage'
import {
  DEVICE_SECRET_KEY,
  decryptString,
  deriveAesGcmKey,
  encryptString,
  hasWebCrypto,
  looksLikeJsonPayload,
  randomSecret,
} from './storageCrypto'

export const AUTH_STORAGE_KEY = 'ranked-gym-auth-v2'
export const CONVEX_AUTH_STORAGE_KEY = 'ranked-gym-convex-auth-v1'
export const CONVEX_AUTH_USER_CACHE_KEY = 'ranked-gym-convex-auth-user-v1'

const AUTH_KEYS = [AUTH_STORAGE_KEY, CONVEX_AUTH_STORAGE_KEY, CONVEX_AUTH_USER_CACHE_KEY] as const

let adapter: SupportedStorage | null = null
let nativePreferred = false

function readLocal(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, value)
}

function deleteLocal(key: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function listLocalKeys(): string[] {
  if (typeof localStorage === 'undefined') return []
  const keys: string[] = []
  try {
    if (typeof localStorage.length !== 'number' || typeof localStorage.key !== 'function') {
      return keys
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
  } catch {
    return keys
  }
  return keys
}

function isSupabaseAuthStorageKey(key: string): boolean {
  return /^sb-[a-z0-9]+-auth-token$/i.test(key) || key === 'supabase.auth.token'
}

export function collectCleartextAuthResidueKeys(): string[] {
  const found: string[] = []
  for (const key of listLocalKeys()) {
    if (AUTH_KEYS.includes(key as (typeof AUTH_KEYS)[number]) || isSupabaseAuthStorageKey(key)) {
      found.push(key)
      continue
    }
    if (key === DEVICE_SECRET_KEY && nativePreferred) {
      found.push(key)
    }
  }
  return found
}

export function purgeCleartextAuthResidues(): void {
  for (const key of collectCleartextAuthResidueKeys()) {
    deleteLocal(key)
  }
  if (nativePreferred) {
    deleteLocal(DEVICE_SECRET_KEY)
  }
}

function createNativeStorage(): SupportedStorage {
  return {
    getItem: (key: string) =>
      SecureStorage.get({ key }).then(({ value }) => (typeof value === 'string' ? value : null)),
    setItem: async (key: string, value: string) => {
      await SecureStorage.set({ key, value })
      deleteLocal(key)
    },
    removeItem: async (key: string) => {
      await SecureStorage.remove({ key })
      deleteLocal(key)
    },
  }
}

async function getWebDeviceSecret(): Promise<string> {
  let secret = readLocal(DEVICE_SECRET_KEY)
  if (!secret) {
    secret = randomSecret()
    writeLocal(DEVICE_SECRET_KEY, secret)
  }
  return secret
}

function createEncryptedWebStorage(): SupportedStorage {
  const getKey = async () => deriveAesGcmKey(await getWebDeviceSecret())
  return {
    getItem: async (key: string) => {
      const raw = readLocal(key)
      if (!raw) return null
      if (looksLikeJsonPayload(raw)) return raw
      if (!hasWebCrypto()) return null
      return decryptString(raw, await getKey())
    },
    setItem: async (key: string, value: string) => {
      if (!hasWebCrypto()) {
        writeLocal(key, value)
        return
      }
      const cipher = await encryptString(value, await getKey())
      writeLocal(key, cipher)
    },
    removeItem: (key: string) => {
      deleteLocal(key)
    },
  }
}

async function migrateLegacyAuthToNative(native: SupportedStorage): Promise<void> {
  if (!hasWebCrypto()) {
    for (const key of AUTH_KEYS) {
      const raw = readLocal(key)
      if (raw && looksLikeJsonPayload(raw)) {
        await native.setItem(key, raw)
      }
      deleteLocal(key)
    }
    deleteLocal(DEVICE_SECRET_KEY)
    return
  }

  const legacySecret = readLocal(DEVICE_SECRET_KEY)
  const legacyKey = legacySecret ? await deriveAesGcmKey(legacySecret) : null

  for (const key of AUTH_KEYS) {
    const existing = await native.getItem(key)
    if (existing) {
      deleteLocal(key)
      continue
    }
    const raw = readLocal(key)
    if (!raw) continue
    const plain = looksLikeJsonPayload(raw) ? raw : legacyKey ? await decryptString(raw, legacyKey) : null
    if (plain) {
      await native.setItem(key, plain)
    }
    deleteLocal(key)
  }
  deleteLocal(DEVICE_SECRET_KEY)
}

export async function initSecureAuthStorage(): Promise<SupportedStorage> {
  await bindSecureStoragePlugin()
  nativePreferred = isNativeSecureStorageAvailable()
  if (!adapter) {
    adapter = nativePreferred ? createNativeStorage() : createEncryptedWebStorage()
  }
  if (nativePreferred) {
    try {
      await migrateLegacyAuthToNative(adapter)
    } catch {
      /* keep native adapter even if migration of one key fails */
    }
    purgeCleartextAuthResidues()
  }
  return adapter
}

export function getSecureAuthStorage(): SupportedStorage {
  if (adapter) return adapter
  nativePreferred = isNativeSecureStorageAvailable()
  adapter = nativePreferred ? createNativeStorage() : createEncryptedWebStorage()
  if (nativePreferred) {
    void migrateLegacyAuthToNative(adapter).then(() => purgeCleartextAuthResidues())
  }
  return adapter
}

export async function clearSecureAuthStorage(): Promise<void> {
  const storage = getSecureAuthStorage()
  await Promise.all(AUTH_KEYS.map((key) => Promise.resolve(storage.removeItem(key))))
  nativePreferred = isNativeSecureStorageAvailable()
  purgeCleartextAuthResidues()
}

export function resetSecureAuthStorageForTests(): void {
  adapter = null
  nativePreferred = false
}
