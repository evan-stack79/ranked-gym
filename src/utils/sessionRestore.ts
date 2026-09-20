import type { AuthUser } from '../services/authService'
import { isNetworkAuthError } from './authErrors'

export type AuthRestoreDecision =
  | { kind: 'disconnected' }
  | {
      kind: 'authenticated'
      user: AuthUser
      source: 'network' | 'local-cache' | 'local-token'
    }

const LOCAL_TOKEN_PLACEHOLDER: AuthUser = {
  id: 'local-session',
  email: '',
  displayName: 'Athlete',
  provider: 'email',
}

export function isServiceUnavailableAuthError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  return (
    lower.includes('auth_service_unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    /\b500\b/.test(lower) ||
    lower.includes('convex auth unavailable') ||
    lower.includes('supabase non configuré') ||
    lower.includes('not configured')
  )
}

export function decideAuthRestore(input: {
  token: string | null
  remoteUser: AuthUser | null
  remoteError: unknown | null
  cachedUser: AuthUser | null
}): AuthRestoreDecision {
  if (input.remoteUser) {
    return { kind: 'authenticated', user: input.remoteUser, source: 'network' }
  }

  const hasToken = Boolean(input.token)
  if (!hasToken) return { kind: 'disconnected' }

  if (input.remoteError) {
    const keepLocal =
      isNetworkAuthError(input.remoteError) || isServiceUnavailableAuthError(input.remoteError)
    if (keepLocal) {
      if (input.cachedUser) {
        return { kind: 'authenticated', user: input.cachedUser, source: 'local-cache' }
      }
      return {
        kind: 'authenticated',
        user: LOCAL_TOKEN_PLACEHOLDER,
        source: 'local-token',
      }
    }
  }

  return { kind: 'disconnected' }
}
