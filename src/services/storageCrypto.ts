/** AES-GCM helpers for web/PWA ciphertext. Not a Keystore substitute. */

export const DEVICE_SECRET_KEY = 'ranked-gym-device-secret'

export function hasWebCrypto(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  )
}

export function getRuntimeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'ranked-gym'
}

export function looksLikeJsonPayload(raw: string): boolean {
  const trimmed = raw.trimStart()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

export function randomSecret(): string {
  if (hasWebCrypto()) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return bytesToBase64(bytes)
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function deriveAesGcmKey(secret: string, origin = getRuntimeOrigin()): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${secret}:${origin}`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptString(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  return bytesToBase64(packed)
}

export async function decryptString(encoded: string, key: CryptoKey): Promise<string | null> {
  try {
    const packed = base64ToBytes(encoded)
    if (packed.length <= 12) return null
    const iv = packed.slice(0, 12)
    const data = packed.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}
