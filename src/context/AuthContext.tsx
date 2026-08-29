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
  requestPasswordReset as apiRequestPasswordReset,
  signInWithEmail as apiSignInWithEmail,
  signOut as apiSignOut,
  updatePassword as apiUpdatePassword,
  updateProfileProgress,
  type AuthUser,
} from '../services/authService'
import {
  friendlyAuthError,
  isAccountEnumerationError,
  validateNewPassword,
} from '../utils/authErrors'
import {
  getPasswordRecoveryRedirectTo,
  PASSWORD_RESET_SENT_MESSAGE,
} from '../utils/authRedirect'
import {
  hydrateCloudBackupForUser,
  resetCloudBackupHydration,
  setCloudBackupUserId,
} from '../services/cloudBackup'
import {
  applyDailyLoginStreak,
  hasCelebratedStreak,
  markStreakCelebrated,
  localDateKey,
} from '../services/streakService'
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

/** Payload for the premium Daily Streak celebration overlay. */
export type StreakCelebration = {
  previousStreak: number
  currentStreak: number
  dateKey: string
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
  /** Set only when streak actually increments N → N+1 (first open of local day). */
  streakCelebration: StreakCelebration | null
  clearStreakCelebration: () => void
  refreshProfile: () => Promise<void>
  /** Met à jour localement le profil (ex. avatar) sans refetch. */
  patchProfile: (patch: Partial<ProfileRow>) => void
  openAuth: (onSuccess?: AuthSuccessCallback) => void
  closeAuth: () => void
  requireAuth: (onSuccess: AuthSuccessCallback) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, pseudo?: string, discipline?: string) => Promise<void>
  /** True after PASSWORD_RECOVERY until the new password is saved. */
  isPasswordRecovery: boolean
  authInfo: string | null
  clearAuthMessages: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordRecovery: (password: string, confirmPassword: string) => Promise<void>
  updateDiscipline: (disciplineLabel: string) => Promise<void>
  updateGhostMode: (enabled: boolean) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)


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
  const [authInfo, setAuthInfo] = useState<string | null>(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [streakWeekBonus, setStreakWeekBonus] = useState<StreakWeekBonus | null>(null)
  const [streakCelebration, setStreakCelebration] = useState<StreakCelebration | null>(null)
  const pendingRef = useRef<AuthSuccessCallback | null>(null)
  const hydrateGenRef = useRef(0)
  const streakInFlightRef = useRef(false)
  const profileRef = useRef<ProfileRow | null>(null)
  const userRef = useRef<AuthUser | null>(null)

  const clearStreakWeekBonus = useCallback(() => setStreakWeekBonus(null), [])
  const clearStreakCelebration = useCallback(() => setStreakCelebration(null), [])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    userRef.current = user
  }, [user])

  const applyStreakForProfile = useCallback(
    async (authUser: AuthUser, row: ProfileRow): Promise<ProfileRow> => {
      if (streakInFlightRef.current) return row
      streakInFlightRef.current = true
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

        const dateKey = localDateKey()
        const currentStreak = streakResult.profile.current_streak
        const previousStreak = streakResult.previousStreak
        const isIncrement = streakResult.didUpdate && currentStreak === previousStreak + 1

        if (
          isIncrement &&
          !hasCelebratedStreak(authUser.id, dateKey, currentStreak)
        ) {
          markStreakCelebrated(authUser.id, dateKey, currentStreak)
          setStreakCelebration({
            previousStreak,
            currentStreak,
            dateKey,
          })
        }

        return streakResult.profile
      } catch {
        // Columns may be missing until SQL migration — keep base profile.
        return row
      } finally {
        streakInFlightRef.current = false
      }
    },
    [],
  )

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
      await applyStreakForProfile(authUser, row)
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
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true)
          setAuthError(null)
          setAuthInfo(null)
          setIsAuthOpen(true)
          void hydrateUser(mapped, metaDisciplineOf(nextSession.user))
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          void hydrateUser(mapped, metaDisciplineOf(nextSession.user))
        }
      } else {
        hydrateGenRef.current += 1
        setUser(null)
        setProfile(null)
        setIsPasswordRecovery(false)
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
    // Recovery : il faut enregistrer le nouveau mot de passe.
    if (isPasswordRecovery) return
    setIsAuthOpen(false)
    setAuthError(null)
    setAuthInfo(null)
    pendingRef.current = null
    setAuthLoading(false)
  }, [session, isPasswordRecovery])

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

  const clearAuthMessages = useCallback(() => {
    setAuthError(null)
    setAuthInfo(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured()) {
      setAuthError(getSupabaseConfigError())
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    setAuthInfo(null)
    try {
      const redirectTo = getPasswordRecoveryRedirectTo()
      await apiRequestPasswordReset(email, redirectTo)
      setAuthInfo(PASSWORD_RESET_SENT_MESSAGE)
    } catch (err) {
      if (isAccountEnumerationError(err)) {
        setAuthInfo(PASSWORD_RESET_SENT_MESSAGE)
      } else {
        setAuthError(friendlyAuthError(err, 'Envoi impossible. Réessaie plus tard.'))
      }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const confirmPasswordRecovery = useCallback(
    async (password: string, confirmPassword: string) => {
      if (!isSupabaseConfigured()) {
        setAuthError(getSupabaseConfigError())
        return
      }
      const validationError = validateNewPassword(password, confirmPassword)
      if (validationError) {
        setAuthError(validationError)
        return
      }
      setAuthLoading(true)
      setAuthError(null)
      setAuthInfo(null)
      try {
        await apiUpdatePassword(password)
        setIsPasswordRecovery(false)
        setAuthInfo('Mot de passe mis à jour. Tu es connecté.')
        window.setTimeout(() => {
          setIsAuthOpen(false)
          setAuthInfo(null)
          pendingRef.current = null
        }, 900)
      } catch (err) {
        setAuthError(friendlyAuthError(err, 'Impossible d’enregistrer le mot de passe.'))
      } finally {
        setAuthLoading(false)
      }
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
    setStreakCelebration(null)
    setIsPasswordRecovery(false)
    setAuthInfo(null)
    setAuthError(null)
    setIsLoading(false)
  }, [])

  // Retour au premier plan après minuit local → nouvelle journée validée (idempotent).
  useEffect(() => {
    const recheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (isLoading) return
      const authUser = userRef.current
      const row = profileRef.current
      if (!authUser || !row) return
      void applyStreakForProfile(authUser, row)
    }
    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('focus', recheck)
    return () => {
      document.removeEventListener('visibilitychange', recheck)
      window.removeEventListener('focus', recheck)
    }
  }, [isLoading, applyStreakForProfile])

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
      streakCelebration,
      clearStreakCelebration,
      refreshProfile,
      patchProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpWithEmail: signUpEmail,
      isPasswordRecovery,
      authInfo,
      clearAuthMessages,
      requestPasswordReset,
      confirmPasswordRecovery,
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
      streakCelebration,
      clearStreakCelebration,
      refreshProfile,
      patchProfile,
      openAuth,
      closeAuth,
      requireAuth,
      signInWithEmail,
      signUpEmail,
      isPasswordRecovery,
      authInfo,
      clearAuthMessages,
      requestPasswordReset,
      confirmPasswordRecovery,
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
