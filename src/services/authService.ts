import { getSupabase } from '../lib/supabase'
import type { ProfileRow } from '../types/database'
import { getRankFromLevel } from '../utils/rank'

export type AuthMethod = 'email' | 'apple' | 'google'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  provider: AuthMethod
}

function providerFromUser(appMetadata: Record<string, unknown> | undefined): AuthMethod {
  const provider = String(appMetadata?.provider ?? 'email')
  if (provider === 'apple') return 'apple'
  if (provider === 'google') return 'google'
  return 'email'
}

export function mapSessionUser(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
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
    provider: providerFromUser(user.app_metadata),
  }
}

export async function signUpWithEmail(email: string, password: string, pseudo?: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        pseudo: pseudo?.trim() || email.split('@')[0] || 'Athlete',
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

export async function signInWithOAuth(provider: 'apple' | 'google') {
  const supabase = getSupabase()
  const redirectTo = `${window.location.origin}/`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
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
        discipline: 'Musculation',
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
  patch: { level?: number; xp?: number; rank?: string; pseudo?: string },
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
