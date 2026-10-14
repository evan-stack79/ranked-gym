/**
 * « Effacer mes anciens repas » — serveur + local + file d’attente.
 * Autorisé pour comptes bloqués (mineur / TCA / âge inconnu).
 */
import { isConvexDomainActive } from '../backend/adapter'
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
import { safeWarn } from '../utils/safeLog'

/** Message exact quand le mode legacy ne peut pas effacer la copie en ligne. */
export const ERASE_MEALS_CONNECT_MESSAGE = 'Connecte-toi pour effacer'

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
 * Supprime tous les repas côté serveur (Convex hard-delete ou push cloud legacy),
 * vide le journal local et retire les meal-upsert / meal-delete en attente.
 */
export async function eraseAllUserMeals(): Promise<{
  localCleared: number
  serverDeleted: number
  pendingMealOpsCleared: number
}> {
  const userId = getActiveCloudUserId()
  const localBefore = countLocalMeals()
  const pendingBefore = userId ? countQueuedMealOpsForUser(userId) : 0

  let serverDeleted = 0

  if (isConvexDomainActive()) {
    try {
      const result = await deleteAllMyMealsViaConvex()
      serverDeleted = result.deletedCount
    } catch (error) {
      safeWarn('[erase-meals] server deleteAll failed', error)
      throw error
    }
    clearLocalMealsAndPendingMealWrites({ userId })
  } else {
    // Mode legacy (Supabase) : doit aussi vider la copie en ligne.
    // Hors ligne / non connecté → refus, pas d’effacement local partiel.
    if (!userId || !isBrowserOnline()) {
      throw new EraseMealsNeedsConnectionError()
    }
    clearLocalMealsAndPendingMealWrites({ userId })
    const { pushCloudBackup } = await import('./cloudBackup')
    const push = await pushCloudBackup(userId)
    if (!push.ok) {
      safeWarn('[erase-meals] legacy cloud clear failed', push.error)
      throw new EraseMealsNeedsConnectionError()
    }
    serverDeleted = localBefore
  }

  return {
    localCleared: localBefore,
    serverDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
