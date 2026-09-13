import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'
import { getActiveAuthBackend } from '../backend/authFeatureFlag'
import { isConvexDomainActive } from '../backend/adapter'
import * as convexAuth from './convexAuthService'
import {
  ensureConvexProfile,
  fetchConvexProfile,
  updateConvexProfileProgress,
} from './convexProfileService'

export type AuthMethod = 'email'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  /** Prénom propre depuis user_metadata (first_name / display_name). */
  firstName?: string
  provider: AuthMethod
}

function isConvexAuthActive(): boolean {
  return getActiveAuthBackend() === 'convex'
}

export function mapSessionUser(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}): AuthUser {
  const meta = user.user_metadata ?? {}
  const metaPseudo = meta.pseudo
  const metaFirstName =
    (typeof meta.first_name === 'string' && meta.first_name.trim()) ||
    (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
    undefined
  const email = user.email ?? ''
  const displayName =
    (typeof metaPseudo === 'string' && metaPseudo.trim()) ||
    email.split('@')[0] ||
    'Athlete'

  return {
    id: user.id,
    email,
    displayName,
    firstName: metaFirstName,
    provider: 'email',
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  pseudo?: string,
  disciplineLabel?: string,
) {
  void disciplineLabel
  if (isConvexAuthActive()) {
    return convexAuth.signUpWithEmail(email, password, pseudo)
  }
  const supabase = getSupabase()
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        pseudo: pseudo?.trim() || email.split('@')[0] || 'Athlete',
        discipline: disciplineLabel?.trim() || 'Musculation',
      },
    },
  })
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  if (isConvexAuthActive()) {
    return convexAuth.signInWithPassword(email, password)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (isConvexAuthActive()) {
    await convexAuth.signOut()
    return
  }
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Envoie un email de récupération. Ne révèle pas si l’adresse existe.
 * `redirectTo` doit être une URL HTTPS publique (voir getPasswordRecoveryRedirectTo).
 */
export async function requestPasswordReset(email: string, redirectTo?: string) {
  if (isConvexAuthActive()) {
    await convexAuth.requestPasswordReset(email, redirectTo)
    return
  }
  const supabase = getSupabase()
  const options = redirectTo ? { redirectTo } : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), options)
  if (error) throw error
}

/** Définit le nouveau mot de passe après l’événement PASSWORD_RECOVERY. */
export async function updatePassword(newPassword: string) {
  if (isConvexAuthActive()) {
    await convexAuth.updatePassword(newPassword)
    return
  }
  const supabase = getSupabase()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Vérifie l’ancien mot de passe puis met à jour le nouveau. */
export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  if (isConvexAuthActive()) {
    await convexAuth.changePassword(email, currentPassword, newPassword)
    return
  }
  const supabase = getSupabase()
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: currentPassword,
  })
  if (reauthError) throw reauthError

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Supprime le compte via Supabase RPC or Convex adapter behind feature flag. */
export async function deleteOwnAccount(password?: string) {
  if (isConvexAuthActive()) {
    if (!password) throw new Error('Password is required for Convex account deletion.')
    await convexAuth.deleteOwnAccount(password)
    return
  }
  const supabase = getSupabase()
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
  await supabase.auth.signOut()
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (isConvexDomainActive()) {
    return fetchConvexProfile(userId)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Fallback if the DB trigger did not run yet (race on first login). */
export async function ensureProfile(
  userId: string,
  pseudo: string,
  disciplineLabel = 'Musculation',
): Promise<ProfileRow> {
  if (isConvexDomainActive()) {
    return ensureConvexProfile(userId, pseudo, disciplineLabel)
  }
  const existing = await fetchProfile(userId)
  if (existing) return existing

  const rank = getRankFromLevel(1)
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        pseudo: pseudo.slice(0, 24) || 'Athlete',
        level: 1,
        xp: 0,
        rank: rank.tier,
        discipline: disciplineLabel.slice(0, 40) || 'Musculation',
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateProfileProgress(
  userId: string,
  patch: {
    level?: number
    xp?: number
    rank?: string
    pseudo?: string
    discipline?: string
    current_streak?: number
    last_login_date?: string | null
    avatar_url?: string | null
    is_ghost_mode_enabled?: boolean
  },
): Promise<ProfileRow> {
  if (isConvexDomainActive()) {
    return updateConvexProfileProgress(userId, patch)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data
}
