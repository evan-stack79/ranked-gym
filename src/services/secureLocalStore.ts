/**
 * Persist local JSON blobs with AES-GCM after boot.
 *
 * Native wrap-key lives in Keystore/Keychain. Web wrap-key is the device
 * secret in localStorage — obfuscation against casual dumps, not XSS-proof.
 * Sync read/write APIs stay intact for hydrate + workout resume.
 */
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

export const SENSITIVE_LOCAL_KEY_PREFIXES = [
  'ranked-gym:training',
  'ranked-gym:nutrition-profile',
  'ranked-gym:nutrition-journal',
  'ranked-gym:sleep-log',
  'ranked-gym:profile',
  'ranked-gym:custom-gyms',
  'ranked-gym:check-in',
  'ranked-gym:last-location',
] as const

const NATIVE_WRAP_KEY = 'ranked-gym-wrap-key'

let wrapKey: CryptoKey | null = null
let encryptionEnabled = false
const memory = new Map<string, string>()
const writeGen = new Map<string, number>()
let persistTail: Promise<void> = Promise.resolve()

export function isSensitiveLocalKey(key: string): boolean {
  return SENSITIVE_LOCAL_KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))
}

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

function rawGet(key: string): string | null {
  if (!storageAvailable()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function rawSet(key: string, value: string): void {
  if (!storageAvailable()) return
  localStorage.setItem(key, value)
}

function rawRemove(key: string): void {
  if (!storageAvailable()) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function listLocalKeys(): string[] {
  if (!storageAvailable()) return []
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

async function readNativeWrapSecret(): Promise<string | null> {
  try {
    const { value } = await SecureStorage.get({ key: NATIVE_WRAP_KEY })
    return typeof value === 'string' && value.length > 0 ? value : null
  } catch {
    return null
  }
}

async function writeNativeWrapSecret(secret: string): Promise<void> {
  await SecureStorage.set({ key: NATIVE_WRAP_KEY, value: secret })
}

async function resolveWrapSecret(): Promise<string> {
  if (isNativeSecureStorageAvailable()) {
    const existing = await readNativeWrapSecret()
    if (existing) {
      rawRemove(DEVICE_SECRET_KEY)
      return existing
    }
    const migrated = rawGet(DEVICE_SECRET_KEY)
    const secret = migrated && migrated.length > 0 ? migrated : randomSecret()
    await writeNativeWrapSecret(secret)
    rawRemove(DEVICE_SECRET_KEY)
    return secret
  }

  let secret = rawGet(DEVICE_SECRET_KEY)
  if (!secret) {
    secret = randomSecret()
    rawSet(DEVICE_SECRET_KEY, secret)
  }
  return secret
}

function enqueuePersist(work: () => Promise<void>): void {
  persistTail = persistTail.then(work, work)
}

async function persistEncrypted(key: string, value: string, generation: number): Promise<void> {
  if (!wrapKey || !encryptionEnabled) return
  if (writeGen.get(key) !== generation) return
  const cipher = await encryptString(value, wrapKey)
  if (writeGen.get(key) !== generation) return
  rawSet(key, cipher)
}

export function readLocal(key: string): string | null {
  if (encryptionEnabled && memory.has(key)) {
    return memory.get(key) ?? null
  }
  const raw = rawGet(key)
  if (!raw) return null
  if (looksLikeJsonPayload(raw)) return raw
  if (encryptionEnabled && wrapKey) {
    return memory.get(key) ?? null
  }
  return raw
}

export function writeLocal(key: string, value: string): void {
  if (!encryptionEnabled || !wrapKey) {
    rawSet(key, value)
    return
  }
  memory.set(key, value)
  const generation = (writeGen.get(key) ?? 0) + 1
  writeGen.set(key, generation)
  enqueuePersist(() => persistEncrypted(key, value, generation))
}

export function removeLocal(key: string): void {
  memory.delete(key)
  writeGen.set(key, (writeGen.get(key) ?? 0) + 1)
  rawRemove(key)
}

export async function initSecureLocalStore(): Promise<void> {
  await bindSecureStoragePlugin()
  if (!hasWebCrypto()) {
    encryptionEnabled = false
    wrapKey = null
    return
  }

  const secret = await resolveWrapSecret()
  wrapKey = await deriveAesGcmKey(secret)
  encryptionEnabled = true
  memory.clear()

  for (const key of listLocalKeys()) {
    if (!isSensitiveLocalKey(key)) continue
    const raw = rawGet(key)
    if (!raw) continue
    if (looksLikeJsonPayload(raw)) {
      memory.set(key, raw)
      const generation = (writeGen.get(key) ?? 0) + 1
      writeGen.set(key, generation)
      enqueuePersist(() => persistEncrypted(key, raw, generation))
      continue
    }
    const plain = await decryptString(raw, wrapKey)
    if (plain != null) {
      memory.set(key, plain)
    }
  }
}

export function flushSecureLocalStore(): Promise<void> {
  return persistTail
}

export function isSecureLocalStoreEnabled(): boolean {
  return encryptionEnabled
}

export function resetSecureLocalStoreForTests(): void {
  wrapKey = null
  encryptionEnabled = false
  memory.clear()
  writeGen.clear()
  persistTail = Promise.resolve()
}
