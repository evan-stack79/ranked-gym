/**
 * « Effacer mes anciens repas » — multi-store, fail-closed.
 * - Même chemin serveur en mode Convex et legacy : lien + purge Supabase via Convex
 * - Count carte = Convex + Supabase (serveur), même si Convex a 0
 * - 0 online + repas locaux déjà sync → erreur
 * - pending-only → effacement local autorisé
 */
import { isConvexDomainActive } from '../backend/adapter'
import { isConvexConfigured } from '../lib/convex'
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
  countSupabaseMealsViaConvex,
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

export type MealsEraseCardState = {
  /** null = serveur muet → UI « Nombre inconnu » + erase bloqué */
  serverCount: number | null
  pendingCount: number
  signedOut: boolean
  /** Convex signé-in sans lien → reconnect ancien compte Supabase */
  needsLegacyReconnect: boolean
}

async function fetchCombinedServerMealCount(): Promise<{
  convexCount: number
  supabaseCount: number
  total: number
}> {
  let convexCount = 0
  if (isConvexDomainActive()) {
    convexCount = requireServerCount(await countActiveMealsViaConvex())
  }
  // B8-03 : toujours interroger Supabase via le serveur (lien), même si Convex = 0.
  const supabaseCount = requireServerCount(await countSupabaseMealsViaConvex())
  return {
    convexCount,
    supabaseCount,
    total: convexCount + supabaseCount,
  }
}

/** État carte : count Convex + Supabase serveur ; pending local séparé. */
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

  if (!isConvexConfigured()) {
    return {
      serverCount: null,
      pendingCount,
      signedOut: false,
      needsLegacyReconnect: false,
    }
  }

  const link = await fetchMyAccountLink()
  const needsLegacyReconnect = link == null

  if (needsLegacyReconnect) {
    // Sans lien : count Convex seul si dispo, sinon unknown pour la partie Supabase.
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
    const { total } = await fetchCombinedServerMealCount()
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
 * Purge repas — même chemin serveur en Convex et « legacy ».
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

  if (!userId || !isBrowserOnline()) {
    throw new EraseMealsNeedsConnectionError()
  }

  if (!isConvexConfigured()) {
    throw new EraseMealsNeedsConnectionError()
  }

  // B8-01 : lien + (si session Supabase téléphone) match obligatoire — chemin serveur unique.
  await requireAccountLinkForErase()

  const { convexCount, supabaseCount, total: serverCount } =
    await fetchCombinedServerMealCount()
  const syncedLocal = countSyncedLocalMeals(userId)
  const pendingLocal = countPendingUnsyncedMeals(userId)

  if (serverCount === 0 && syncedLocal > 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  // Pending-only + rien online : effacement local sans purge online
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

  // Supabase d’abord (même si Convex = 0) — fail-closed, téléphone intact.
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

  let convexDeleted = 0
  if (convexCount > 0 && isConvexDomainActive()) {
    try {
      const result = await deleteAllMyMealsViaConvex()
      convexDeleted = requireServerCount(result?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  } else if (supabaseCount > 0) {
    // B8-03 : erase a tourné la purge Supabase ; Convex n’avait rien.
    convexDeleted = 0
  }

  const confirmedServerDeleted = requireServerCount(convexDeleted + supabaseDeleted)
  clearLocalMealsAndPendingMealWrites({ userId })

  return {
    localCleared: localBefore,
    serverDeleted: confirmedServerDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
