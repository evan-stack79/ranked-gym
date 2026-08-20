export type AuthProvider = 'email' | 'apple' | 'google'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  provider: AuthProvider
}

export interface AuthSession {
  token: string
  user: AuthUser
  createdAt: number
}

const AUTH_KEY = 'ranked-gym:auth-session'

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || !parsed?.user?.email) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(AUTH_KEY)
    return
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
}

function makeToken(): string {
  return `rg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() || 'Athlete'
  return local
    .replace(/[._-]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 18)
}

export function getAuthSession(): AuthSession | null {
  return readSession()
}

export function mockSignInWithEmail(email: string, _password: string): AuthSession {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@') || normalized.length < 5) {
    throw new Error('Entre une adresse email valide.')
  }

  const session: AuthSession = {
    token: makeToken(),
    createdAt: Date.now(),
    user: {
      id: `user-${normalized}`,
      email: normalized,
      displayName: displayNameFromEmail(normalized),
      provider: 'email',
    },
  }
  writeSession(session)
  return session
}

export function mockSignInWithProvider(provider: 'apple' | 'google'): AuthSession {
  const email =
    provider === 'apple' ? 'evan@icloud.com' : 'evan.lift@gmail.com'
  const displayName = provider === 'apple' ? 'Evan_Apple' : 'Evan_Google'

  const session: AuthSession = {
    token: makeToken(),
    createdAt: Date.now(),
    user: {
      id: `user-${provider}`,
      email,
      displayName,
      provider,
    },
  }
  writeSession(session)
  return session
}

export function mockSignOut(): void {
  writeSession(null)
}
