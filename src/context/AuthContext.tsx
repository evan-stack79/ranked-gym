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
import {
  setLocalGhostModeEnabled,
} from '../services/ghostModeStorage'
import { safeError, safeWarn } from '../utils/safeLog'

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
  updateGhostMode: (enabled: boolean) => Promise<void>
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

const HYDRATE_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`))
    }, ms)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
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
      await withTimeout(
        hydrateCloudBackupForUser(authUser.id),
        HYDRATE_TIMEOUT_MS,
        'hydrateCloudBackupForUser',
      )
    } catch (e) {
      safeError('[auth] hydrateCloudBackupForUser failed', e)
    }
  }, [])

  const hydrateUser = useCallback(
    async (authUser: AuthUser, metaDiscipline?: string) => {
      const gen = ++hydrateGenRef.current
      setIsLoading(true)
      try {
        await withTimeout(
          loadProfile(authUser, metaDiscipline),
          HYDRATE_TIMEOUT_MS,
          'loadProfile',
        )
      } catch (error) {
        safeError('[auth] hydrateUser failed', error)
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

    void supabase.auth
      .getSession()
      .then(({ data }) => {
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
      .catch((error) => {
        safeError('[auth] getSession failed', error)
        if (!cancelled) setIsLoading(false)
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
    // Bêta privée : pas de fermeture tant qu’il n’y a pas de session Supabase.
    if (!session?.user) return
    setIsAuthOpen(false)
    setAuthError(null)
    pendingRef.current = null
    setAuthLoading(false)
  }, [session])

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

  /** Inscriptions publiques désactivées (bêta fermée / invitation uniquement). */
  const signUpEmail = useCallback(
    async (_email: string, _password: string, _pseudo?: string, _discipline?: string) => {
      setAuthError(
        'Bêta fermée. Les inscriptions publiques sont actuellement désactivées.',
      )
      setAuthLoading(false)
    },
    [],
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

  const updateGhostMode = useCallback(
    async (enabled: boolean) => {
      setLocalGhostModeEnabled(enabled)
      patchProfile({ is_ghost_mode_enabled: enabled })
      if (!user || !isSupabaseConfigured()) return
      try {
        const row = await updateProfileProgress(user.id, { is_ghost_mode_enabled: enabled })
        setProfile(row)
        setLocalGhostModeEnabled(row.is_ghost_mode_enabled ?? enabled)
      } catch (error) {
        safeWarn('[auth] updateGhostMode remote failed, kept local', error)
      } finally {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ranked-gym:ghost-mode-changed'))
        }
      }
    },
    [user, patchProfile],
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
      updateGhostMode,
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
      updateGhostMode,
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
