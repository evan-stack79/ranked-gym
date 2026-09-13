import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex, isConvexConfigured } from '../lib/convex'
import { getSecureAuthStorage } from './secureAuthStorage'
import type { AuthUser } from './authService'

const CONVEX_AUTH_STORAGE_KEY = 'ranked-gym-convex-auth-v1'
const api = generatedApi as any

function readTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const queryToken = new URL(window.location.href).searchParams.get('token')
    if (queryToken) return queryToken.trim()
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return null
    const params = new URLSearchParams(hash)
    return params.get('token')?.trim() || null
  } catch {
    return null
  }
}

async function getStoredSessionToken(): Promise<string | null> {
  const value = await Promise.resolve(getSecureAuthStorage().getItem(CONVEX_AUTH_STORAGE_KEY))
  if (!value || typeof value !== 'string') return null
  return value
}

async function setStoredSessionToken(token: string): Promise<void> {
  await Promise.resolve(getSecureAuthStorage().setItem(CONVEX_AUTH_STORAGE_KEY, token))
}

async function clearStoredSessionToken(): Promise<void> {
  await Promise.resolve(getSecureAuthStorage().removeItem(CONVEX_AUTH_STORAGE_KEY))
}

function mapAuthUser(user: { userId: string; email: string; displayName: string }): AuthUser {
  return {
    id: user.userId,
    email: user.email,
    displayName: user.displayName,
    provider: 'email',
  }
}

function requireConvexClient() {
  if (!isConvexConfigured()) {
    throw new Error('Convex auth unavailable: VITE_CONVEX_URL is not configured.')
  }
  return getConvex()
}

async function requireSessionToken(): Promise<string> {
  const token = await getStoredSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export async function signUpWithEmail(
  email: string,
  password: string,
  pseudo?: string,
): Promise<{ user: AuthUser; sessionToken: string; mustResetPassword: boolean }> {
  const client = requireConvexClient()
  const result = await client.mutation(api.auth.signUpWithEmail, {
    email,
    password,
    displayName: pseudo,
  })
  await setStoredSessionToken(result.sessionToken)
  return {
    user: mapAuthUser(result.user),
    sessionToken: result.sessionToken,
    mustResetPassword: result.mustResetPassword,
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ user: AuthUser; sessionToken: string; mustResetPassword: boolean }> {
  const client = requireConvexClient()
  const result = await client.mutation(api.auth.signInWithPassword, { email, password })
  await setStoredSessionToken(result.sessionToken)
  return {
    user: mapAuthUser(result.user),
    sessionToken: result.sessionToken,
    mustResetPassword: result.mustResetPassword,
  }
}

export async function signOut(): Promise<void> {
  const token = await getStoredSessionToken()
  const client = requireConvexClient()
  if (token) {
    await client.mutation(api.auth.signOut, { sessionToken: token })
  }
  await clearStoredSessionToken()
}

export async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const client = requireConvexClient()
  await client.mutation(api.auth.requestPasswordReset, { email, redirectTo })
}

export async function updatePassword(newPassword: string): Promise<void> {
  const client = requireConvexClient()
  const token = readTokenFromLocation()
  if (!token) {
    throw new Error('AUTH_RESET_TOKEN_MISSING')
  }
  const result = await client.mutation(api.auth.consumePasswordReset, { token, newPassword })
  await setStoredSessionToken(result.sessionToken)
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  void email
  const client = requireConvexClient()
  const sessionToken = await requireSessionToken()
  const result = await client.mutation(api.auth.changePassword, {
    sessionToken,
    currentPassword,
    newPassword,
  })
  await setStoredSessionToken(result.sessionToken)
}

export async function deleteOwnAccount(password: string): Promise<void> {
  const client = requireConvexClient()
  const sessionToken = await requireSessionToken()
  await client.mutation(api.auth.deleteOwnAccount, { sessionToken, password })
  await clearStoredSessionToken()
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const client = requireConvexClient()
  const sessionToken = await getStoredSessionToken()
  if (!sessionToken) return null
  const session = await client.query(api.auth.getSession, { sessionToken })
  if (!session) return null
  return mapAuthUser(session)
}
