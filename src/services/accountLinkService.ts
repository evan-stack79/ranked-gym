/**
 * Client : lien Convex ↔ Supabase.
 * Le téléphone n’envoie jamais un supabaseUserId — seulement l’access token de session.
 */
import { api } from '../../convex/_generated/api'
import { isConvexConfigured, getConvex } from '../lib/convex'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { getConvexSessionToken } from './convexAuthService'
import {
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  EraseMealsPurgeError,
} from './purgeSupabaseMealCopies'
import { safeWarn } from '../utils/safeLog'

export const ERASE_MEALS_RECONNECT_LEGACY_MESSAGE =
  'Connecte-toi à ton ancien compte pour effacer'

export class EraseMealsNeedsLegacyReconnectError extends Error {
  constructor() {
    super(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
    this.name = 'EraseMealsNeedsLegacyReconnectError'
  }
}

export type AccountLinkInfo = {
  ownerUserId: string
  supabaseUserId: string
  linkedAt: number
}

async function requireConvexSessionToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  return token
}

/** Lit uniquement le lien du compte de session (serveur refuse les autres). */
export async function fetchMyAccountLink(): Promise<AccountLinkInfo | null> {
  if (!isConvexConfigured()) return null
  try {
    const sessionToken = await getConvexSessionToken()
    if (!sessionToken) return null
    const link = (await getConvex().query(api.accountLinks.getMyLink, {
      sessionToken,
    })) as AccountLinkInfo | null
    return link
  } catch (error) {
    safeWarn('[account-link] getMyLink failed', error)
    return null
  }
}

/**
 * Crée le lien en envoyant seulement l’access token Supabase.
 * Le serveur résout l’id via Auth getUser.
 */
export async function linkLegacySupabaseAccountWithAccessToken(
  supabaseAccessToken: string,
): Promise<AccountLinkInfo> {
  if (!isConvexConfigured()) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  const token = supabaseAccessToken.trim()
  if (!token) throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  const sessionToken = await requireConvexSessionToken()
  try {
    const result = (await getConvex().action(api.accountLinks.linkSupabaseAccount, {
      sessionToken,
      supabaseAccessToken: token,
    })) as {
      ok: true
      ownerUserId: string
      supabaseUserId: string
    }
    if (!result?.ok || !result.supabaseUserId) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    return {
      ownerUserId: result.ownerUserId,
      supabaseUserId: result.supabaseUserId,
      linkedAt: Date.now(),
    }
  } catch (error) {
    if (error instanceof EraseMealsPurgeError) throw error
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('ACCOUNT_LINK_SUPABASE_UNRESOLVED') ||
      message.includes('ACCOUNT_LINK_ALREADY_TAKEN') ||
      message.includes('ACCOUNT_LINK_IMMUTABLE') ||
      message.includes('ACCOUNT_LINK_UNAUTHORIZED')
    ) {
      safeWarn('[account-link] link refused', message)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    safeWarn('[account-link] link failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
}

/**
 * Sign-in à l’ancien compte Supabase depuis la carte erase, puis création du lien.
 * N’altère pas la session Convex (stockages distincts).
 */
export async function signInLegacySupabaseAndLink(
  email: string,
  password: string,
): Promise<AccountLinkInfo> {
  if (!isSupabaseConfigured()) {
    throw new EraseMealsNeedsLegacyReconnectError()
  }
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  const accessToken = data?.session?.access_token
  if (error || !accessToken) {
    safeWarn('[account-link] legacy supabase sign-in failed', error?.message)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  try {
    return await linkLegacySupabaseAccountWithAccessToken(accessToken)
  } finally {
    // Session Supabase téléphone non requise après le lien.
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
  }
}

/**
 * Avant erase Convex : le lien doit exister. Pas de token Supabase téléphone.
 */
export async function requireAccountLinkForErase(): Promise<AccountLinkInfo> {
  const link = await fetchMyAccountLink()
  if (!link) throw new EraseMealsNeedsLegacyReconnectError()
  return link
}
