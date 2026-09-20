import type { AuthContextValue } from '../context/AuthContext'
import type { AuthUser } from '../services/authService'

const noop = () => undefined
const asyncNoop = async () => undefined

export const FIXTURE_AUTH_USER: AuthUser = {
  id: 'user-welcome-fixture',
  email: 'invite@ranked.gym',
  displayName: 'Alex',
  firstName: 'Alex',
  provider: 'email',
}

export function buildAuthContextValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  const { bootIssue, retryHydrate, ...restOverrides } = overrides

  return {
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: false,
    bootIssue: null,
    retryHydrate: asyncNoop,
    isAuthOpen: false,
    authLoading: false,
    authError: null,
    streakWeekBonus: null,
    clearStreakWeekBonus: noop,
    streakCelebration: null,
    clearStreakCelebration: noop,
    refreshProfile: asyncNoop,
    patchProfile: noop,
    openAuth: noop,
    closeAuth: noop,
    requireAuth: noop,
    signInWithEmail: asyncNoop,
    signUpWithEmail: asyncNoop,
    isPasswordRecovery: false,
    authInfo: null,
    clearAuthMessages: noop,
    requestPasswordReset: asyncNoop,
    confirmPasswordRecovery: asyncNoop,
    updateDiscipline: asyncNoop,
    updateGhostMode: asyncNoop,
    signOut: asyncNoop,
    ...restOverrides,
    bootIssue: bootIssue ?? null,
    retryHydrate: retryHydrate ?? asyncNoop,
  }
}
