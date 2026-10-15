/**
 * Client : lien Convex ↔ Supabase.
 * Le téléphone n’envoie jamais un supabaseUserId / email — seulement l’access token.
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

export const ERASE_MEALS_LINK_REFUSED_MESSAGE =
  'Impossible de relier ton ancien compte. Contacte-nous.'

export const ERASE_MEALS_EMAIL_CODE_REQUIRED_MESSAGE =
  'Confirme ton e-mail avec le code reçu, puis relie ton compte.'

export class EraseMealsNeedsLegacyReconnectError extends Error {
  constructor() {
    super(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
    this.name = 'EraseMealsNeedsLegacyReconnectError'
  }
}

export class EraseMealsLinkRefusedError extends Error {
  constructor() {
    super(ERASE_MEALS_LINK_REFUSED_MESSAGE)
    this.name = 'EraseMealsLinkRefusedError'
  }
}

export class EraseMealsEmailCodeRequiredError extends Error {
  constructor() {
    super(ERASE_MEALS_EMAIL_CODE_REQUIRED_MESSAGE)
    this.name = 'EraseMealsEmailCodeRequiredError'
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

async function readOptionalPhoneSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await getSupabase().auth.getSession()
    const token = data?.session?.access_token
    if (error || !token) return null
    return token
  } catch {
    return null
  }
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
 * Le serveur résout id + emails et refuse mismatch / non confirmé.
 * Convex emailConfirmedAt doit déjà être posé (code e-mail ou Google) — B9-01/B9-02.
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
    if (error instanceof EraseMealsLinkRefusedError) throw error
    if (error instanceof EraseMealsEmailCodeRequiredError) throw error
    const message = error instanceof Error ? error.message : ''
    if (message.includes('ACCOUNT_LINK_EMAIL_UNCONFIRMED')) {
      // B9-02 : legacy / signup sans code → demander le code une fois.
      safeWarn('[account-link] email unconfirmed — code required', message)
      throw new EraseMealsEmailCodeRequiredError()
    }
    if (message.includes('ACCOUNT_LINK_EMAIL_MISMATCH')) {
      safeWarn('[account-link] link refused (email mismatch)', message)
      throw new EraseMealsLinkRefusedError()
    }
    if (message.includes('EMAIL_PROVIDER_NOT_CONFIGURED')) {
      safeWarn('[account-link] mailer not configured', message)
      throw new EraseMealsLinkRefusedError()
    }
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
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
  }
}

/**
 * Avant erase : lien requis. Si une session Supabase téléphone est présente,
 * le serveur vérifie qu’elle correspond au lien (B8-01 legacy).
 */
export async function requireAccountLinkForErase(): Promise<AccountLinkInfo> {
  if (!isConvexConfigured()) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  const sessionToken = await requireConvexSessionToken()
  const phoneToken = await readOptionalPhoneSupabaseAccessToken()
  try {
    const result = (await getConvex().action(api.accountLinks.assertLinkForErase, {
      sessionToken,
      ...(phoneToken ? { supabaseAccessToken: phoneToken } : {}),
    })) as { ok: true; ownerUserId: string; supabaseUserId: string }
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
    if (error instanceof EraseMealsNeedsLegacyReconnectError) throw error
    const message = error instanceof Error ? error.message : ''
    if (message.includes('ACCOUNT_LINK_MISSING')) {
      throw new EraseMealsNeedsLegacyReconnectError()
    }
    if (message.includes('ACCOUNT_LINK_MISMATCH')) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    safeWarn('[erase-meals] account link assert failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
}
