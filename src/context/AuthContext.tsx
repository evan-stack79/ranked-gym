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
  updateProfileProgress,
  type AuthUser,
} from '../services/authService'
import {
  hydrateCloudBackupForUser,
  resetCloudBackupHydration,
  setCloudBackupUserId,
} from '../services/cloudBackup'
import { applyDailyLoginStreak } from '../services/streakService'
import {
  disciplineFromLabel,
  getDiscipline,
  storeDisciplineId,
} from '../data/disciplines'
import { setPrimarySport } from '../services/trainingStorage'

function syncLocalDiscipline(label: string) {
  const id = disciplineFromLabel(label)
  storeDisciplineId(id)
  setPrimarySport(getDiscipline(id).primarySportId)
}

type AuthSuccessCallback = () => void

export type StreakWeekBonus = {
  streak: number
  bonusXp: number
}

interface AuthContextValue {
  user: AuthUser | null
  profile: ProfileRow | null
  isAuthenticated: boolean
  /**
   * True until the initial session check finishes, and — if logged in —
   * until profile + cloud backup hydrate complete (success or error).
   * Prevents Flash of Stale Data on refresh.
   */
  isLoading: boolean
  isAuthOpen: boolean
  authLoading: boolean
  authError: string | null
  /** Fired when daily streak hits a multiple of 7 (show Accueil celebration). */
  streakWeekBonus: StreakWeekBonus | null
  clearStreakWeekBonus: () => void
  refreshProfile: () => Promise<void>
  /** Met à jour localement le profil (ex. avatar) sans refetch. */
  patchProfile: (patch: Partial<ProfileRow>) => void
  openAuth: (onSuccess?: AuthSuccessCallback) => void
  closeAuth: () => void
  requireAuth: (onSuccess: AuthSuccessCallback) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, pseudo?: string, discipline?: string) => Promise<void>
  updateDiscipline: (disciplineLabel: string) => Promise<void>
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

function metaDisciplineOf(user: { user_metadata?: Record<string, unknown> }): string | undefined {
  return typeof user.user_metadata?.discipline === 'string'
    ? user.user_metadata.discipline
    : undefined
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [streakWeekBonus, setStreakWeekBonus] = useState<StreakWeekBonus | null>(null)
  const pendingRef = useRef<AuthSuccessCallback | null>(null)
  const hydrateGenRef = useRef(0)

  const clearStreakWeekBonus = useCallback(() => setStreakWeekBonus(null), [])

  const loadProfile = useCallback(async (authUser: AuthUser, metaDiscipline?: string) => {
    setCloudBackupUserId(authUser.id)
    let row: ProfileRow | null = null
    try {
      row = await ensureProfile(
        authUser.id,
        authUser.displayName,
        metaDiscipline || 'Musculation',
      )
      setProfile(row)
      setUser({ ...authUser, displayName: row.pseudo || authUser.displayName })
      syncLocalDiscipline(row.discipline)
    } catch {
      try {
        row = await fetchProfile(authUser.id)
        setProfile(row)
        if (row?.discipline) syncLocalDiscipline(row.discipline)
      } catch {
        setProfile(null)
        row = null
      }
    }

    if (row) {
      try {
        const streakResult = await applyDailyLoginStreak(row)
        setProfile(streakResult.profile)
        setUser({
          ...authUser,
          displayName: streakResult.profile.pseudo || authUser.displayName,
        })
        if (streakResult.weekBonus && streakResult.bonusXp > 0) {
          setStreakWeekBonus({
            streak: streakResult.profile.current_streak,
            bonusXp: streakResult.bonusXp,
          })
        }
      } catch {
        // Columns may be missing until SQL migration — keep base profile.
      }
    }

    try {
      await hydrateCloudBackupForUser(authUser.id)
    } catch (e) {
      console.error('[auth] hydrateCloudBackupForUser failed:', e)
    }
  }, [])

  const hydrateUser = useCallback(
    async (authUser: AuthUser, metaDiscipline?: string) => {
      const gen = ++hydrateGenRef.current
      setIsLoading(true)
      try {
        await loadProfile(authUser, metaDiscipline)
      } finally {
        if (hydrateGenRef.current === gen) {
          setIsLoading(false)
        }
      }
    },
    [loadProfile],
  )

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const row = await fetchProfile(user.id)
    setProfile(row)
  }, [user])

  const patchProfile = useCallback((patch: Partial<ProfileRow>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false)
      return
    }

    const supabase = getSupabase()
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const next = data.session
      setSession(next)
      if (next?.user) {
        const mapped = mapSessionUser(next.user)
        setUser(mapped)
        void hydrateUser(mapped, metaDisciplineOf(next.user))
      } else {
        setIsLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return
      // Boot path is handled by getSession to avoid double hydrate / early unlock.
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }

      setSession(nextSession)
      if (nextSession?.user) {
        const mapped = mapSessionUser(nextSession.user)
        setUser(mapped)
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
          void hydrateUser(mapped, metaDisciplineOf(nextSession.user))
        }
      } else {
        hydrateGenRef.current += 1
        setUser(null)
        setProfile(null)
        resetCloudBackupHydration()
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [hydrateUser])

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
    async (email: string, password: string, pseudo?: string, discipline?: string) => {
      if (!isSupabaseConfigured()) {
        setAuthError(getSupabaseConfigError())
        return
      }
      setAuthLoading(true)
      setAuthError(null)
      try {
        const data = await signUpWithEmail(email, password, pseudo, discipline)
        if (discipline) syncLocalDiscipline(discipline)
        if (!data.session) {
          setAuthError(
            'Compte créé, mais la confirmation email est encore activée sur Supabase. Désactive “Confirm email” (Authentication → Providers → Email), puis reconnecte-toi avec le même email/mot de passe.',
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

  const updateDiscipline = useCallback(
    async (disciplineLabel: string) => {
      syncLocalDiscipline(disciplineLabel)
      if (!user || !isSupabaseConfigured()) return
      try {
        const row = await updateProfileProgress(user.id, { discipline: disciplineLabel })
        setProfile(row)
      } catch {
        // local sync already done
      }
    },
    [user],
  )

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await apiSignOut()
    }
    hydrateGenRef.current += 1
    resetCloudBackupHydration()
    setSession(null)
    setUser(null)
    setProfile(null)
    setStreakWeekBonus(null)
    setIsLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      isAuthOpen,
      authLoading,
      authError,
      streakWeekBonus,
      clearStreakWeekBonus,
      refreshProfile,
      patchProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpWithEmail: signUpEmail,
      updateDiscipline,
      signOut,
    }),
    [
      user,
      profile,
      session,
      isLoading,
      isAuthOpen,
      authLoading,
      authError,
      streakWeekBonus,
      clearStreakWeekBonus,
      refreshProfile,
      patchProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpEmail,
      updateDiscipline,
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
