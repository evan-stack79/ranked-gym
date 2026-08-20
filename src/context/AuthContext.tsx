import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession, AuthUser } from '../services/authStorage'
import {
  getAuthSession,
  mockSignInWithEmail,
  mockSignInWithProvider,
  mockSignOut,
} from '../services/authStorage'

type AuthSuccessCallback = () => void

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAuthOpen: boolean
  authLoading: boolean
  authError: string | null
  openAuth: (onSuccess?: AuthSuccessCallback) => void
  closeAuth: () => void
  requireAuth: (onSuccess: AuthSuccessCallback) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const pendingRef = useRef<AuthSuccessCallback | null>(null)

  useEffect(() => {
    setSession(getAuthSession())
  }, [])

  const finishAuth = useCallback((next: AuthSession) => {
    setSession(next)
    setAuthError(null)
    setIsAuthOpen(false)
    setAuthLoading(false)
    const cb = pendingRef.current
    pendingRef.current = null
    queueMicrotask(() => cb?.())
  }, [])

  const openAuth = useCallback((onSuccess?: AuthSuccessCallback) => {
    setAuthError(null)
    pendingRef.current = onSuccess ?? null
    setIsAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => {
    setIsAuthOpen(false)
    setAuthError(null)
    pendingRef.current = null
    setAuthLoading(false)
  }, [])

  const requireAuth = useCallback(
    (onSuccess: AuthSuccessCallback) => {
      if (session) {
        onSuccess()
        return
      }
      openAuth(onSuccess)
    },
    [session, openAuth],
  )

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthLoading(true)
      setAuthError(null)
      await new Promise((r) => setTimeout(r, 550))
      try {
        const next = mockSignInWithEmail(email, password)
        finishAuth(next)
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Connexion impossible.')
        setAuthLoading(false)
      }
    },
    [finishAuth],
  )

  const signInWithApple = useCallback(async () => {
    setAuthLoading(true)
    setAuthError(null)
    await new Promise((r) => setTimeout(r, 700))
    finishAuth(mockSignInWithProvider('apple'))
  }, [finishAuth])

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true)
    setAuthError(null)
    await new Promise((r) => setTimeout(r, 700))
    finishAuth(mockSignInWithProvider('google'))
  }, [finishAuth])

  const signOut = useCallback(() => {
    mockSignOut()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session != null,
      isAuthOpen,
      authLoading,
      authError,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signInWithApple,
      signInWithGoogle,
      signOut,
    }),
    [
      session,
      isAuthOpen,
      authLoading,
      authError,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signInWithApple,
      signInWithGoogle,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
