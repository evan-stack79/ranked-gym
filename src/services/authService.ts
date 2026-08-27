import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'

export type AuthMethod = 'email'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  /** Prénom propre depuis user_metadata (first_name / display_name). */
  firstName?: string
  provider: AuthMethod
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
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Envoie un email de récupération. Ne révèle pas si l’adresse existe.
 * `redirectTo` doit être une URL HTTPS publique (voir getPasswordRecoveryRedirectTo).
 */
export async function requestPasswordReset(email: string, redirectTo?: string) {
  const supabase = getSupabase()
  const options = redirectTo ? { redirectTo } : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), options)
  if (error) throw error
}

/** Définit le nouveau mot de passe après l’événement PASSWORD_RECOVERY. */
export async function updatePassword(newPassword: string) {
  const supabase = getSupabase()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Vérifie l’ancien mot de passe puis met à jour le nouveau. */
export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  const supabase = getSupabase()
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: currentPassword,
  })
  if (reauthError) throw reauthError

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Supprime le compte via RPC `delete_own_account` (cascade auth.users). */
export async function deleteOwnAccount() {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
  await supabase.auth.signOut()
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
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
