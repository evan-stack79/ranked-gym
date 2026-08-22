/**
 * Stockage auth Supabase — SecureStore natif si Capacitor, sinon chiffrement Web Crypto.
 * Les tokens ne sont jamais persistés en clair dans localStorage.
 */
import type { SupportedStorage } from '@supabase/supabase-js'

const STORAGE_KEY = 'ranked-gym-auth-v2'
const DEVICE_SECRET_KEY = 'ranked-gym-device-secret'

type CapacitorSecureStorage = {
  get: (opts: { key: string }) => Promise<{ value: string | null }>
  set: (opts: { key: string; value: string }) => Promise<void>
  remove: (opts: { key: string }) => Promise<void>
}

function getCapacitorSecureStorage(): CapacitorSecureStorage | null {
  if (typeof window === 'undefined') return null
  const cap = (window as Window & { Capacitor?: { Plugins?: { SecureStoragePlugin?: CapacitorSecureStorage } } })
    .Capacitor
  return cap?.Plugins?.SecureStoragePlugin ?? null
}

async function getDeviceCryptoKey(): Promise<CryptoKey> {
  let secret = localStorage.getItem(DEVICE_SECRET_KEY)
  if (!secret) {
    secret = crypto.randomUUID()
    localStorage.setItem(DEVICE_SECRET_KEY, secret)
  }
  const material = new TextEncoder().encode(`${secret}:${window.location.origin}`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt(plain: string): Promise<string> {
  const key = await getDeviceCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...packed))
}

async function decrypt(encoded: string): Promise<string | null> {
  try {
    const key = await getDeviceCryptoKey()
    const packed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
    const iv = packed.slice(0, 12)
    const data = packed.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

function createEncryptedWebStorage(): SupportedStorage {
  return {
    getItem: (key: string) => {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return decrypt(raw)
    },
    setItem: (key: string, value: string) => {
      void encrypt(value)
        .then((cipher) => localStorage.setItem(key, cipher))
        .catch(() => {
          /* drop write on crypto failure */
        })
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key)
    },
  }
}

function createCapacitorStorage(secure: CapacitorSecureStorage): SupportedStorage {
  return {
    getItem: (key: string) => secure.get({ key }).then(({ value }) => value),
    setItem: (key: string, value: string) => secure.set({ key, value }),
    removeItem: (key: string) => secure.remove({ key }),
  }
}

let adapter: SupportedStorage | null = null

export function getSecureAuthStorage(): SupportedStorage {
  if (adapter) return adapter
  const secure = getCapacitorSecureStorage()
  adapter = secure ? createCapacitorStorage(secure) : createEncryptedWebStorage()
  return adapter
}

export const AUTH_STORAGE_KEY = STORAGE_KEY
