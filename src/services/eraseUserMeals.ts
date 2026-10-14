/**
 * « Effacer mes anciens repas » — multi-store, fail-closed.
 * - Compte lié : lien + purge Supabase via Convex ; dédup meal id (B9-03)
 * - Supabase-only : access token vérifié serveur, pas de lien (B9-02)
 * - Backups Convex toujours nettoyés même si 0 repas Convex (B9-04)
 * - 0 online + repas locaux déjà sync → erreur
 * - pending-only → effacement local autorisé
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
  /** Compte Supabase-only (token) — erase sans lien */
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
  // B9-03 : même meal id des deux côtés compté une seule fois.
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
  if (!userId) {
    // Supabase-only : session téléphone sans userId Convex local.
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
  const pendingCount = countPendingUnsyncedMeals(userId)

  if (!isConvexConfigured()) {
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  }

  const link = await fetchMyAccountLink()
  const needsLegacyReconnect = link == null && isConvexDomainActive()

  if (needsLegacyReconnect) {
    const phoneToken = await readOptionalPhoneSupabaseAccessToken()
    if (phoneToken) {
      try {
        const supabase = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
        let convexCount = 0
        if (isConvexDomainActive()) {
          try {
            convexCount = requireServerCount(await countActiveMealsViaConvex())
          } catch {
            convexCount = 0
          }
        }
        return {
          serverCount: requireServerCount(convexCount + supabase.count),
          pendingCount,
          signedOut: false,
          needsLegacyReconnect: false,
          supabaseOnly: true,
        }
      } catch (error) {
        safeWarn('[erase-meals] supabase-only count (no link) failed', error)
      }
    }
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
    if (link) {
      const { total } = await fetchDedupedLinkedServerMealCount()
      return {
        serverCount: total,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect: false,
      }
    }
    // Legacy domain + Supabase session without Convex link.
    const phoneToken = await readOptionalPhoneSupabaseAccessToken()
    if (phoneToken) {
      const result = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
      return {
        serverCount: requireServerCount(result.count),
        pendingCount,
        signedOut: false,
        needsLegacyReconnect: false,
        supabaseOnly: true,
      }
    }
    return {
      serverCount: null,
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
 * Purge repas — lien Convex ou Supabase-only (token).
 * Jamais de purge Supabase directe téléphone (B8-01).
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

  const link = userId ? await fetchMyAccountLink() : null
  const phoneToken = await readOptionalPhoneSupabaseAccessToken()

  // --- Supabase-only path (no Convex link) ---
  if (!link) {
    if (phoneToken) {
      return eraseSupabaseOnlyMeals({
        userId,
        phoneToken,
        localBefore,
        pendingBefore,
      })
    }
    if (userId && isConvexDomainActive()) {
      throw new EraseMealsNeedsLegacyReconnectError()
    }
    throw new EraseMealsNeedsConnectionError()
  }

  // --- Linked path ---
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
    // B9-04 : toujours nettoyer backups Convex même à 0 repas.
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

  // B9-04 : toujours appeler deleteAllMyMeals (backups) même si convexCount = 0.
  if (isConvexDomainActive()) {
    try {
      await deleteAllMyMealsViaConvex()
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  // B9-03 : serverDeleted = count dédupliqué pré-purge (pas somme Convex+Supabase).
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
  try {
    const counted = await countSupabaseMealsByAccessTokenViaConvex(phoneToken)
    supabaseCount = requireServerCount(counted.count)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('SUPABASE_TOKEN_UNRESOLVED')) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    safeWarn('[erase-meals] supabase-only count failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  const syncedLocal = userId ? countSyncedLocalMeals(userId) : 0
  const pendingLocal = userId ? countPendingUnsyncedMeals(userId) : 0

  if (supabaseCount === 0 && syncedLocal > 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  if (supabaseCount === 0 && syncedLocal === 0) {
    if (pendingLocal > 0 || localBefore > 0) {
      clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })
    }
    if (userId && isConvexDomainActive()) {
      try {
        await deleteAllMyMealsViaConvex()
      } catch (error) {
        safeWarn('[erase-meals] Convex backup cleanup (supabase-only 0) failed', error)
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
    const purge = await purgeSupabaseMealCopiesByAccessTokenViaConvex(phoneToken)
    supabaseDeleted = requireServerCount(purge?.deletedCount)
    // Never erase another's account — resolved id must match token identity (server-enforced).
  } catch (error) {
    if (error instanceof EraseMealsPurgeError) throw error
    safeWarn('[erase-meals] supabase-only purge failed', error)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  // B9-04 : si session Convex active, nettoyer backups même sans repas Convex.
  if (userId && isConvexDomainActive()) {
    try {
      await deleteAllMyMealsViaConvex()
    } catch (error) {
      safeWarn('[erase-meals] Convex backup cleanup after supabase-only failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  clearLocalMealsAndPendingMealWrites({ userId: userId ?? undefined })
  return {
    localCleared: localBefore,
    serverDeleted: supabaseDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
