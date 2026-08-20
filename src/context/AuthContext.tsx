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
import type { Session } from '@supabase/supabase-js'
import type { ProfileRow } from '../types/database'
import { getSupabaseConfigError, isSupabaseConfigured, getSupabase } from '../lib/supabase'
import {
  ensureProfile,
  fetchProfile,
  mapSessionUser,
  signInWithEmail as apiSignInWithEmail,
  signOut as apiSignOut,
  signUpWithEmail,
  type AuthUser,
} from '../services/authService'

type AuthSuccessCallback = () => void

interface AuthContextValue {
  user: AuthUser | null
  profile: ProfileRow | null
  isAuthenticated: boolean
  isAuthOpen: boolean
  authLoading: boolean
  authError: string | null
  refreshProfile: () => Promise<void>
  openAuth: (onSuccess?: AuthSuccessCallback) => void
  closeAuth: () => void
  requireAuth: (onSuccess: AuthSuccessCallback) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, pseudo?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function friendlyAuthError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.'
  }
  if (lower.includes('user already registered')) {
    return 'Cet email est déjà utilisé. Passe sur Connexion.'
  }
  if (lower.includes('password') && lower.includes('6')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.'
  }
  if (lower.includes('email')) {
    return raw
  }
  return raw || fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const pendingRef = useRef<AuthSuccessCallback | null>(null)

  const loadProfile = useCallback(async (authUser: AuthUser) => {
    try {
      const row = await ensureProfile(authUser.id, authUser.displayName)
      setProfile(row)
      setUser({ ...authUser, displayName: row.pseudo || authUser.displayName })
    } catch {
      const row = await fetchProfile(authUser.id)
      setProfile(row)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const row = await fetchProfile(user.id)
    setProfile(row)
  }, [user])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = getSupabase()

    void supabase.auth.getSession().then(({ data }) => {
      const next = data.session
      setSession(next)
      if (next?.user) {
        const mapped = mapSessionUser(next.user)
        setUser(mapped)
        void loadProfile(mapped)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        const mapped = mapSessionUser(nextSession.user)
        setUser(mapped)
        void loadProfile(mapped)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const completePending = useCallback(() => {
    const cb = pendingRef.current
    pendingRef.current = null
    setIsAuthOpen(false)
    setAuthLoading(false)
    setAuthError(null)
    queueMicrotask(() => cb?.())
  }, [])

  const openAuth = useCallback((onSuccess?: AuthSuccessCallback) => {
    setAuthError(getSupabaseConfigError())
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
      if (session?.user) {
        onSuccess()
        return
      }
      openAuth(onSuccess)
    },
    [session, openAuth],
  )

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured()) {
        setAuthError(getSupabaseConfigError())
        return
      }
      setAuthLoading(true)
      setAuthError(null)
      try {
        await apiSignInWithEmail(email, password)
        completePending()
      } catch (err) {
        setAuthError(friendlyAuthError(err, 'Connexion impossible.'))
        setAuthLoading(false)
      }
    },
    [completePending],
  )

  const signUpEmail = useCallback(
    async (email: string, password: string, pseudo?: string) => {
      if (!isSupabaseConfigured()) {
        setAuthError(getSupabaseConfigError())
        return
      }
      setAuthLoading(true)
      setAuthError(null)
      try {
        const data = await signUpWithEmail(email, password, pseudo)
        if (!data.session) {
          setAuthError(
            'Compte créé. Si la confirmation email est activée sur Supabase, valide ton mail puis reconnecte-toi.',
          )
          setAuthLoading(false)
          return
        }
        completePending()
      } catch (err) {
        setAuthError(friendlyAuthError(err, 'Inscription impossible.'))
        setAuthLoading(false)
      }
    },
    [completePending],
  )

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await apiSignOut()
    }
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(session?.user),
      isAuthOpen,
      authLoading,
      authError,
      refreshProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpWithEmail: signUpEmail,
      signOut,
    }),
    [
      user,
      profile,
      session,
      isAuthOpen,
      authLoading,
      authError,
      refreshProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpEmail,
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
