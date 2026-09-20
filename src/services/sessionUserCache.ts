import type { AuthUser } from './authService'
import {
  CONVEX_AUTH_USER_CACHE_KEY,
  getSecureAuthStorage,
} from './secureAuthStorage'

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const row = value as AuthUser
  return (
    typeof row.id === 'string' &&
    typeof row.email === 'string' &&
    typeof row.displayName === 'string' &&
    row.provider === 'email'
  )
}

export async function readCachedSessionUser(): Promise<AuthUser | null> {
  try {
    const raw = await Promise.resolve(getSecureAuthStorage().getItem(CONVEX_AUTH_USER_CACHE_KEY))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isAuthUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function writeCachedSessionUser(user: AuthUser): Promise<void> {
  await Promise.resolve(
    getSecureAuthStorage().setItem(CONVEX_AUTH_USER_CACHE_KEY, JSON.stringify(user)),
  )
}

export async function clearCachedSessionUser(): Promise<void> {
  await Promise.resolve(getSecureAuthStorage().removeItem(CONVEX_AUTH_USER_CACHE_KEY))
}
