/**
 * « Effacer mes anciens repas » — multi-store, fail-closed.
 * - Lien compte app ↔ Supabase : créé serveur (migration / reconnect) ; erase Convex
 *   purge les copies legacy côté serveur via le lien, sans session Supabase téléphone.
 * - deletedCount / card count : serveur uniquement
 * - 0 online + repas locaux déjà sync → erreur
 * - pending-only → effacement local autorisé
 */
import { isConvexDomainActive } from '../backend/adapter'
import { isConvexConfigured } from '../lib/convex'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
  EraseMealsNeedsLegacyReconnectError,
  fetchMyAccountLink,
  requireAccountLinkForErase,
} from './accountLinkService'
import { getActiveCloudUserId } from './cloudSession'
import { countActiveMealsViaSupabase } from './countSupabaseMeals'
import {
  countActiveMealsViaConvex,
  deleteAllMyMealsViaConvex,
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
  purgeSupabaseMealCopies,
} from './purgeSupabaseMealCopies'
import { safeWarn } from '../utils/safeLog'

export const ERASE_MEALS_CONNECT_MESSAGE = 'Connecte-toi pour effacer'
export const ERASE_MEALS_COUNT_UNKNOWN_MESSAGE = 'Nombre inconnu, réessaie'
export const ERASE_MEALS_NONE_MESSAGE = 'Aucun ancien repas'
export { ERASE_MEALS_RECONNECT_LEGACY_MESSAGE, EraseMealsNeedsLegacyReconnectError }

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

export type MealsEraseCardState = {
  /** null = serveur muet → UI « Nombre inconnu » + erase bloqué */
  serverCount: number | null
  pendingCount: number
  signedOut: boolean
  /** Convex signé-in sans lien → reconnect ancien compte Supabase */
  needsLegacyReconnect: boolean
}

/** État carte : count serveur only + pending local séparé. */
export async function fetchMealsEraseCardState(): Promise<MealsEraseCardState> {
  const userId = getActiveCloudUserId()
  if (!userId) {
    return {
      serverCount: null,
      pendingCount: 0,
      signedOut: true,
      needsLegacyReconnect: false,
    }
  }
  const pendingCount = countPendingUnsyncedMeals(userId)

  let needsLegacyReconnect = false
  if (isConvexDomainActive() && isConvexConfigured()) {
    const link = await fetchMyAccountLink()
    needsLegacyReconnect = link == null
  }

  try {
    let serverCount: number
    if (isConvexDomainActive()) {
      serverCount = await countActiveMealsViaConvex()
    } else if (isSupabaseConfigured()) {
      serverCount = await countActiveMealsViaSupabase()
    } else {
      return {
        serverCount: null,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect,
      }
    }
    if (typeof serverCount !== 'number' || !Number.isFinite(serverCount)) {
      return {
        serverCount: null,
        pendingCount,
        signedOut: false,
        needsLegacyReconnect,
      }
    }
    return { serverCount, pendingCount, signedOut: false, needsLegacyReconnect }
  } catch (error) {
    safeWarn('[erase-meals] server count failed', error)
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect,
    }
  }
}

/** @deprecated prefer fetchMealsEraseCardState — ne plus fusionner local+serveur. */
export async function fetchStoredMealsCount(): Promise<number> {
  const state = await fetchMealsEraseCardState()
  return state.serverCount ?? 0
}

async function fetchServerMealCount(): Promise<number> {
  if (isConvexDomainActive()) {
    return requireServerCount(await countActiveMealsViaConvex())
  }
  if (isSupabaseConfigured()) {
    return requireServerCount(await countActiveMealsViaSupabase())
  }
  throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
}

/**
 * Purge repas. Ne touche ni online ni local si lien / sync incohérents.
 */
export async function eraseAllUserMeals(): Promise<{
  localCleared: number
  serverDeleted: number
  pendingMealOpsCleared: number
}> {
  const userId = getActiveCloudUserId()
  const localBefore = countLocalMeals()
  const pendingBefore = userId ? countQueuedMealOpsForUser(userId) : 0

  if (!userId || !isBrowserOnline()) {
    throw new EraseMealsNeedsConnectionError()
  }

  const convexActive = isConvexDomainActive()
  const supabaseConfigured = isSupabaseConfigured()

  if (!convexActive && !supabaseConfigured) {
    throw new EraseMealsNeedsConnectionError()
  }

  // Convex : lien requis ; purge Supabase côté serveur (pas de session téléphone).
  if (convexActive) {
    if (!isConvexConfigured()) {
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    await requireAccountLinkForErase()
  }

  const serverCount = await fetchServerMealCount()
  const syncedLocal = countSyncedLocalMeals(userId)
  const pendingLocal = countPendingUnsyncedMeals(userId)

  // B6-02 : 0 online mais repas déjà sync sur le téléphone → incohérence, rien n’est effacé
  if (serverCount === 0 && syncedLocal > 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  // Pending-only + serveur 0 : effacement local sans purge online destructive
  if (serverCount === 0 && syncedLocal === 0) {
    if (pendingLocal > 0 || localBefore > 0) {
      clearLocalMealsAndPendingMealWrites({ userId })
    }
    return {
      localCleared: localBefore,
      serverDeleted: 0,
      pendingMealOpsCleared: pendingBefore,
    }
  }

  let serverDeleted: number | undefined

  if (convexActive) {
    try {
      const result = await deleteAllMyMealsViaConvex()
      serverDeleted = requireServerCount(result?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }

    // Lien présent → serveur purge les copies Supabase, sans JWT téléphone.
    try {
      const supabasePurge = await purgeSupabaseMealCopiesViaConvex()
      requireServerCount(supabasePurge?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsNeedsLegacyReconnectError) throw error
      if (error instanceof EraseMealsPurgeError) throw error
      const message = error instanceof Error ? error.message : ''
      if (message.includes('ACCOUNT_LINK_MISSING')) {
        throw new EraseMealsNeedsLegacyReconnectError()
      }
      safeWarn('[erase-meals] Convex→Supabase purge failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  } else {
    try {
      const purge = await purgeSupabaseMealCopies()
      serverDeleted = requireServerCount(purge?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Supabase meal purge failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  const confirmedServerDeleted = requireServerCount(serverDeleted)
  clearLocalMealsAndPendingMealWrites({ userId })

  return {
    localCleared: localBefore,
    serverDeleted: confirmedServerDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
