/**
 * Client : assertion du lien Convex/app ↔ Supabase avant purge.
 */
import { api } from '../../convex/_generated/api'
import { isConvexConfigured, getConvex } from '../lib/convex'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { ERASE_MEALS_PURGE_FAILED_MESSAGE, EraseMealsPurgeError } from './purgeSupabaseMealCopies'
import { safeWarn } from '../utils/safeLog'

async function getSupabaseAccessToken(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  const { data, error } = await getSupabase().auth.getSession()
  const token = data?.session?.access_token
  if (error || !token) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  return token
}

/**
 * Vérifie que le compte Supabase signé-in est celui lié à ownerUserId (app).
 * Pas de lien / mismatch → EraseMealsPurgeError (rien ne doit être effacé).
 */
export async function assertAccountLinkForErase(ownerUserId: string): Promise<{
  ownerUserId: string
  supabaseUserId: string
}> {
  if (!ownerUserId) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  if (!isConvexConfigured()) {
    // Sans Convex on ne peut pas lire le lien serveur → fail-closed si Supabase est en jeu.
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  const supabaseAccessToken = await getSupabaseAccessToken()
  try {
    const result = (await getConvex().action(api.accountLinks.assertLinkForErase, {
      ownerUserId,
      supabaseAccessToken,
    })) as { ok: true; ownerUserId: string; supabaseUserId: string }
    if (!result?.ok || result.supabaseUserId == null) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    return { ownerUserId: result.ownerUserId, supabaseUserId: result.supabaseUserId }
  } catch (error) {
    if (error instanceof EraseMealsPurgeError) throw error
    safeWarn('[erase-meals] account link assert failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
}
