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
  signInWithOAuth,
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
  signInWithApple: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
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
    if (!isSupabaseConfigured()) {
      setHydrated(true)
      return
    }

    const supabase = getSupabase()

    void supabase.auth.getSession().then(({ data }) => {
      const next = data.session
      setSession(next)
      if (next?.user) {
        const mapped = mapSessionUser(next.user)
        setUser(mapped)
        void loadProfile(mapped)
      }
      setHydrated(true)
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
        setAuthError(err instanceof Error ? err.message : 'Connexion impossible.')
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
            'Compte créé. Vérifie ton email si la confirmation est activée, puis reconnecte-toi.',
          )
          setAuthLoading(false)
          return
        }
        completePending()
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Inscription impossible.')
        setAuthLoading(false)
      }
    },
    [completePending],
  )

  const signInWithApple = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAuthError(getSupabaseConfigError())
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      await signInWithOAuth('apple')
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Apple Sign-In non disponible. Active le provider dans Supabase.',
      )
      setAuthLoading(false)
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAuthError(getSupabaseConfigError())
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      await signInWithOAuth('google')
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In non disponible. Active le provider dans Supabase.',
      )
      setAuthLoading(false)
    }
  }, [])

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
      signInWithApple,
      signInWithGoogle,
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
      signInWithApple,
      signInWithGoogle,
      signOut,
      hydrated,
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
