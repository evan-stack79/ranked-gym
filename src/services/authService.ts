import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'

export type AuthMethod = 'email'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  provider: AuthMethod
}

export function mapSessionUser(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}): AuthUser {
  const metaPseudo = user.user_metadata?.pseudo
  const email = user.email ?? ''
  const displayName =
    (typeof metaPseudo === 'string' && metaPseudo.trim()) ||
    email.split('@')[0] ||
    'Athlete'

  return {
    id: user.id,
    email,
    displayName,
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
