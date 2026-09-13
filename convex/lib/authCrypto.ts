const PASSWORD_HASH_PREFIX = 'pbkdf2_sha256'
const PASSWORD_HASH_ITERATIONS = 210_000
const PASSWORD_HASH_BITS = 256
const SESSION_TOKEN_BYTES = 32

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(raw: string): Uint8Array {
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function normalizePassword(value: string): string {
  return value.normalize('NFKC')
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i]
  }
  return diff === 0
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const saltBytes = Uint8Array.from(salt)
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizePassword(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    material,
    PASSWORD_HASH_BITS,
  )
  return new Uint8Array(derived)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function hashToken(rawToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken))
  return toBase64Url(new Uint8Array(digest))
}

export function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES))
  return toBase64Url(bytes)
}

export function assertPasswordPolicy(password: string, minLength = 6): void {
  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters`)
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const digest = await pbkdf2(password, salt, PASSWORD_HASH_ITERATIONS)
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(digest)}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [prefix, iterationsRaw, saltRaw, digestRaw] = encoded.split('$')
  if (prefix !== PASSWORD_HASH_PREFIX) return false
  const iterations = Number.parseInt(iterationsRaw, 10)
  if (!Number.isFinite(iterations) || iterations < 10_000) return false
  if (!saltRaw || !digestRaw) return false
  const salt = fromBase64Url(saltRaw)
  const expected = fromBase64Url(digestRaw)
  const actual = await pbkdf2(password, salt, iterations)
  return constantTimeEqual(actual, expected)
}
