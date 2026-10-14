/**
 * « Effacer mes anciens repas » — toutes les copies (Convex + Supabase) + local.
 * Autorisé pour comptes bloqués (mineur / TCA / âge inconnu).
 * Fail-closed : si une copie en ligne n’est pas purgée → pas de succès.
 */
import { isConvexDomainActive } from '../backend/adapter'
import { isSupabaseConfigured } from '../lib/supabase'
import { getActiveCloudUserId } from './cloudSession'
import {
  countActiveMealsViaConvex,
  deleteAllMyMealsViaConvex,
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
 * Purge repas sur Convex (meals + journalJson + legacy_supabase_backups) et/ou
 * Supabase (nutrition.journal + user_backups.payload), puis local + queue.
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

  // Au moins un backend en ligne doit pouvoir purger.
  if (!convexActive && !supabaseConfigured) {
    throw new EraseMealsNeedsConnectionError()
  }

  let serverDeleted = 0

  // 1) Convex : hard-delete meals + strip journalJson + legacy_supabase_backups
  if (convexActive) {
    try {
      const result = await deleteAllMyMealsViaConvex()
      serverDeleted = result.deletedCount
    } catch (error) {
      safeWarn('[erase-meals] Convex deleteAll failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  // 2) Supabase : nutrition.journal + user_backups.payload (si configuré)
  //    Obligatoire en legacy ; en Convex primary aussi dès que les credentials existent
  //    (copies de migration / anciens syncs).
  if (supabaseConfigured || !convexActive) {
    try {
      const purge = await purgeSupabaseMealCopies(userId)
      if (purge.skipped && !convexActive) {
        throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
      }
    } catch (error) {
      if (error instanceof EraseMealsPurgeError) throw error
      safeWarn('[erase-meals] Supabase meal purge failed', error)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
  }

  // 3) Local seulement après succès distant — bouton reste retryable sinon.
  clearLocalMealsAndPendingMealWrites({ userId })
  if (!convexActive) {
    serverDeleted = Math.max(serverDeleted, localBefore)
  }

  return {
    localCleared: localBefore,
    serverDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
