/**
 * « Effacer mes anciens repas » — toutes les copies (Convex + Supabase) + local.
 * Fail-closed : si une copie en ligne n’est pas purgée → pas de succès.
 * deletedCount : uniquement valeurs serveur (jamais le count téléphone).
 */
import { isConvexDomainActive } from '../backend/adapter'
import { isSupabaseConfigured } from '../lib/supabase'
import { getActiveCloudUserId } from './cloudSession'
import {
  countActiveMealsViaConvex,
  deleteAllMyMealsViaConvex,
  purgeSupabaseMealCopiesViaConvex,
} from './convexNutritionService'
import {
  clearLocalMealsAndPendingMealWrites,
  countLocalMeals,
} from './nutritionStorage'
import { countQueuedMealOpsForUser } from './convexNutritionQueue'
import {
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  EraseMealsPurgeError,
  purgeSupabaseMealCopies,
} from './purgeSupabaseMealCopies'
import { safeWarn } from '../utils/safeLog'

/** Message exact quand hors ligne / non connecté. */
export const ERASE_MEALS_CONNECT_MESSAGE = 'Connecte-toi pour effacer'

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

function requireServerDeletedCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  return value
}

export async function fetchStoredMealsCount(): Promise<number> {
  const local = countLocalMeals()
  if (!isConvexDomainActive()) return local
  try {
    const remote = await countActiveMealsViaConvex()
    return Math.max(local, remote)
  } catch (error) {
    safeWarn('[erase-meals] count remote failed', error)
    return local
  }
}

/**
 * Purge repas sur Convex + Supabase, puis local.
 * Ne vide le local qu’après succès de toutes les copies applicables.
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

  let serverDeleted: number | undefined

  if (convexActive) {
    try {
      const result = await deleteAllMyMealsViaConvex()
      serverDeleted = requireServerDeletedCount(result?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }

    // Si Supabase est dans l’env client, le serveur doit purger via session Convex
    // (identité résolue serveur — jamais un userId téléphone).
    if (supabaseConfigured) {
      try {
        const supabasePurge = await purgeSupabaseMealCopiesViaConvex()
        requireServerDeletedCount(supabasePurge?.deletedCount)
      } catch (error) {
        if (error instanceof EraseMealsPurgeError) throw error
        safeWarn('[erase-meals] Convex→Supabase purge failed', error)
        throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
      }
    }
  } else {
    // Legacy Supabase : auth.getUser() côté purge — jamais userId argument.
    try {
      const purge = await purgeSupabaseMealCopies()
      serverDeleted = requireServerDeletedCount(purge?.deletedCount)
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Supabase meal purge failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  const confirmedServerDeleted = requireServerDeletedCount(serverDeleted)

  clearLocalMealsAndPendingMealWrites({ userId })

  return {
    localCleared: localBefore,
    serverDeleted: confirmedServerDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
