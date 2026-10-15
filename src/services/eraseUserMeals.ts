/**
 * « Effacer mes anciens repas » — multi-store, fail-closed.
 * - Compte Convex lié : lien + purge Supabase via Convex ; dédup meal id (B9-03)
 * - Supabase-only : UNIQUEMENT s’il n’y a PAS de session Convex (B10-01)
 * - Convex signé-in sans lien → reconnect, jamais le JWT Supabase résiduel téléphone
 * - Backups Convex toujours nettoyés même si 0 repas Convex (B9-04)
 */
import { isConvexDomainActive } from '../backend/adapter'
import { isConvexConfigured } from '../lib/convex'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  ERASE_MEALS_LINK_REFUSED_MESSAGE,
  ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
  EraseMealsLinkRefusedError,
  EraseMealsNeedsLegacyReconnectError,
  fetchMyAccountLink,
  requireAccountLinkForErase,
} from './accountLinkService'
import { getActiveCloudUserId } from './cloudSession'
import { getConvexSessionToken } from './convexAuthService'
import {
  countActiveMealsViaConvex,
  countSupabaseMealsByAccessTokenViaConvex,
  deleteAllMyMealsViaConvex,
  listActiveMealIdsViaConvex,
  listSupabaseMealIdsViaConvex,
  purgeSupabaseMealCopiesByAccessTokenViaConvex,
  purgeSupabaseMealCopiesViaConvex,
} from './convexNutritionService'
import { countQueuedMealOpsForUser } from './convexNutritionQueue'
import {
  countPendingUnsyncedMeals,
  countSyncedLocalMeals,
} from './localMealSyncState'
import {
  clearLocalMealsAndPendingMealWrites,
  countLocalMeals,
} from './nutritionStorage'
import {
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  EraseMealsPurgeError,
} from './purgeSupabaseMealCopies'
import { safeWarn } from '../utils/safeLog'

export const ERASE_MEALS_CONNECT_MESSAGE = 'Connecte-toi pour effacer'
export const ERASE_MEALS_COUNT_UNKNOWN_MESSAGE = 'Nombre inconnu, réessaie'
export const ERASE_MEALS_NONE_MESSAGE = 'Aucun ancien repas'
export {
  ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
  ERASE_MEALS_LINK_REFUSED_MESSAGE,
  EraseMealsNeedsLegacyReconnectError,
  EraseMealsLinkRefusedError,
}

export { ERASE_MEALS_PURGE_FAILED_MESSAGE, EraseMealsPurgeError }

export class EraseMealsNeedsConnectionError extends Error {
  constructor() {
    super(ERASE_MEALS_CONNECT_MESSAGE)
    this.name = 'EraseMealsNeedsConnectionError'
  }
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

function requireServerCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  return value
}

/** Union size by meal id — 5+5 same ids => 5 (B9-03). */
export function dedupeMealCountByIds(convexIds: string[], supabaseIds: string[]): number {
  const set = new Set<string>()
  for (const id of convexIds) {
    if (typeof id === 'string' && id.trim()) set.add(id.trim())
  }
  for (const id of supabaseIds) {
    if (typeof id === 'string' && id.trim()) set.add(id.trim())
  }
  return set.size
}

export type MealsEraseCardState = {
  /** null = serveur muet → UI « Nombre inconnu » + erase bloqué */
  serverCount: number | null
  pendingCount: number
  signedOut: boolean
  /** Convex signé-in sans lien → reconnect ancien compte Supabase */
  needsLegacyReconnect: boolean
  /** Compte Supabase-only (token) — erase sans lien ; jamais si session Convex */
  supabaseOnly?: boolean
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

/** B10-01 : session Convex active (compte Ranked Gym), indépendamment du JWT Supabase téléphone. */
async function hasConvexAccountSession(): Promise<boolean> {
  if (!isConvexConfigured()) return false
  const token = await getConvexSessionToken()
  return Boolean(token && token.trim())
}

async function fetchDedupedLinkedServerMealCount(): Promise<{
  convexCount: number
  supabaseCount: number
  total: number
}> {
  let convexIds: string[] = []
  let convexCount = 0
  if (isConvexDomainActive()) {
    convexIds = await listActiveMealIdsViaConvex()
    convexCount = convexIds.length
  }
  const supabaseIds = await listSupabaseMealIdsViaConvex()
  const supabaseCount = supabaseIds.length
  const total = dedupeMealCountByIds(convexIds, supabaseIds)
  return {
    convexCount: requireServerCount(convexCount),
    supabaseCount: requireServerCount(supabaseCount),
    total: requireServerCount(total),
  }
}

/** État carte : count dédupliqué ; pending local séparé. */
export async function fetchMealsEraseCardState(): Promise<MealsEraseCardState> {
  const userId = getActiveCloudUserId()
  const convexSignedIn = await hasConvexAccountSession()

  // B10-01 : sans session Convex → Supabase-only possible via token téléphone.
  if (!convexSignedIn) {
    if (!userId) {
      const phoneToken = await readOptionalPhoneSupabaseAccessToken()
      if (phoneToken && isConvexConfigured()) {
        try {
          const result = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
          return {
            serverCount: requireServerCount(result.count),
            pendingCount: 0,
            signedOut: false,
            needsLegacyReconnect: false,
            supabaseOnly: true,
          }
        } catch (error) {
          safeWarn('[erase-meals] supabase-only count failed', error)
          return {
            serverCount: null,
            pendingCount: 0,
            signedOut: false,
            needsLegacyReconnect: false,
            supabaseOnly: true,
          }
        }
      }
      return {
        serverCount: null,
        pendingCount: 0,
        signedOut: true,
        needsLegacyReconnect: false,
      }
    }
    // Legacy cloud user id without Convex session — count via Supabase token only.
    const pendingCount = countPendingUnsyncedMeals(userId)
    if (!isConvexConfigured()) {
      return {
        serverCount: null,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect: false,
      }
    }
    const phoneToken = await readOptionalPhoneSupabaseAccessToken()
    if (phoneToken) {
      try {
        const result = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
        return {
          serverCount: requireServerCount(result.count),
          pendingCount,
          signedOut: false,
          needsLegacyReconnect: false,
          supabaseOnly: true,
        }
      } catch (error) {
        safeWarn('[erase-meals] supabase-only count (no convex session) failed', error)
        return {
          serverCount: null,
          pendingCount,
          signedOut: false,
          needsLegacyReconnect: false,
          supabaseOnly: true,
        }
      }
    }
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  }

  // --- Convex account signed in ---
  const pendingCount = userId ? countPendingUnsyncedMeals(userId) : 0

  if (!isConvexConfigured()) {
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  }

  const link = await fetchMyAccountLink()
  if (link == null) {
    // B10-01 : jamais utiliser le JWT Supabase résiduel ; reconnect seulement.
    try {
      const convexCount = isConvexDomainActive()
        ? requireServerCount(await countActiveMealsViaConvex())
        : 0
      return {
        serverCount: convexCount,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect: true,
      }
    } catch (error) {
      safeWarn('[erase-meals] convex count failed (no link)', error)
      return {
        serverCount: null,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect: true,
      }
    }
  }

  try {
    const { total } = await fetchDedupedLinkedServerMealCount()
    return {
      serverCount: total,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  } catch (error) {
    safeWarn('[erase-meals] server count failed', error)
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  }
}

/** @deprecated prefer fetchMealsEraseCardState — ne plus fusionner local+serveur. */
export async function fetchStoredMealsCount(): Promise<number> {
  const state = await fetchMealsEraseCardState()
  return state.serverCount ?? 0
}

/**
 * Purge repas — lien Convex (si session Convex) ou Supabase-only (sans session Convex).
 */
export async function eraseAllUserMeals(): Promise<{
  localCleared: number
  serverDeleted: number
  pendingMealOpsCleared: number
}> {
  const userId = getActiveCloudUserId()
  const localBefore = countLocalMeals()
  const pendingBefore = userId ? countQueuedMealOpsForUser(userId) : 0

  if (!isBrowserOnline()) {
    throw new EraseMealsNeedsConnectionError()
  }

  if (!isConvexConfigured()) {
    throw new EraseMealsNeedsConnectionError()
  }

  const convexSignedIn = await hasConvexAccountSession()
  const phoneToken = await readOptionalPhoneSupabaseAccessToken()

  // B10-01 : session Convex ⇒ chemin lien uniquement (jamais JWT Supabase téléphone).
  if (convexSignedIn) {
    const link = await fetchMyAccountLink()
    if (!link) {
      throw new EraseMealsNeedsLegacyReconnectError()
    }
    return eraseLinkedConvexMeals({
      userId,
      localBefore,
      pendingBefore,
    })
  }

  // Supabase-only : pas de compte Convex signé-in.
  if (phoneToken) {
    return eraseSupabaseOnlyMeals({
      userId,
      phoneToken,
      localBefore,
      pendingBefore,
    })
  }

  throw new EraseMealsNeedsConnectionError()
}

async function eraseLinkedConvexMeals(args: {
  userId: string | null
  localBefore: number
  pendingBefore: number
}): Promise<{
  localCleared: number
  serverDeleted: number
  pendingMealOpsCleared: number
}> {
  const { userId, localBefore, pendingBefore } = args
  await requireAccountLinkForErase()

  const { convexCount, total: serverCount } = await fetchDedupedLinkedServerMealCount()
  const syncedLocal = userId ? countSyncedLocalMeals(userId) : 0
  const pendingLocal = userId ? countPendingUnsyncedMeals(userId) : 0

  if (serverCount === 0 && syncedLocal > 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  if (serverCount === 0 && syncedLocal === 0) {
    if (pendingLocal > 0 || localBefore > 0) {
      clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })
    }
    if (isConvexDomainActive()) {
      try {
        await deleteAllMyMealsViaConvex()
      } catch (error) {
        safeWarn('[erase-meals] Convex backup cleanup (0 meals) failed', error)
        throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
      }
    }
    return {
      localCleared: localBefore,
      serverDeleted: 0,
      pendingMealOpsCleared: pendingBefore,
    }
  }

  let supabaseDeleted = 0
  try {
    const supabasePurge = await purgeSupabaseMealCopiesViaConvex()
    supabaseDeleted = requireServerCount(supabasePurge?.deletedCount)
  } catch (error) {
    if (error instanceof EraseMealsNeedsLegacyReconnectError) throw error
    if (error instanceof EraseMealsPurgeError) throw error
    const message = error instanceof Error ? error.message : ''
    if (message.includes('ACCOUNT_LINK_MISSING')) {
      throw new EraseMealsNeedsLegacyReconnectError()
    }
    if (message.includes('ACCOUNT_LINK_MISMATCH')) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    safeWarn('[erase-meals] Convex→Supabase purge failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  if (isConvexDomainActive()) {
    try {
      await deleteAllMyMealsViaConvex()
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  void supabaseDeleted
  void convexCount
  const serverDeleted = requireServerCount(serverCount)

  clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })

  return {
    localCleared: localBefore,
    serverDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}

async function eraseSupabaseOnlyMeals(args: {
  userId: string | null
  phoneToken: string
  localBefore: number
  pendingBefore: number
}): Promise<{
  localCleared: number
  serverDeleted: number
  pendingMealOpsCleared: number
}> {
  const { userId, phoneToken, localBefore, pendingBefore } = args
  let supabaseCount = 0
  let resolvedUserId = ''
  try {
    const counted = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
    supabaseCount = requireServerCount(counted.count)
    resolvedUserId = counted.resolvedUserId
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('SUPABASE_TOKEN_UNRESOLVED')) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    safeWarn('[erase-meals] supabase-only count failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  // B10-01 : n’efface le cache téléphone que s’il appartient au même compte que le token.
  const phoneDataBelongsToTokenAccount =
    userId == null || userId === resolvedUserId

  const syncedLocal =
    phoneDataBelongsToTokenAccount && userId ? countSyncedLocalMeals(userId) : 0
  const pendingLocal =
    phoneDataBelongsToTokenAccount && userId ? countPendingUnsyncedMeals(userId) : 0

  if (supabaseCount === 0 && syncedLocal > 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  if (supabaseCount === 0 && syncedLocal === 0) {
    if (phoneDataBelongsToTokenAccount && (pendingLocal > 0 || localBefore > 0)) {
      clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })
    }
    return {
      localCleared: phoneDataBelongsToTokenAccount ? localBefore : 0,
      serverDeleted: 0,
      pendingMealOpsCleared: phoneDataBelongsToTokenAccount ? pendingBefore : 0,
    }
  }

  let supabaseDeleted = 0
  try {
    const purge = await purgeSupabaseMealCopiesByAccessTokenViaConvex(phoneToken)
    supabaseDeleted = requireServerCount(purge?.deletedCount)
    if (purge.resolvedUserId !== resolvedUserId) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  } catch (error) {
    if (error instanceof EraseMealsPurgeError) throw error
    safeWarn('[erase-meals] supabase-only purge failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  if (phoneDataBelongsToTokenAccount) {
    clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })
  }

  return {
    localCleared: phoneDataBelongsToTokenAccount ? localBefore : 0,
    serverDeleted: supabaseDeleted,
    pendingMealOpsCleared: phoneDataBelongsToTokenAccount ? pendingBefore : 0,
  }
}
