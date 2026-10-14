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
 * Supprime tous les repas côté serveur (si Convex), vide le journal local
 * et retire les meal-upsert / meal-delete en attente — rien ne revient au sync.
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
  }

  clearLocalMealsAndPendingMealWrites({ userId })

  return {
    localCleared: localBefore,
    serverDeleted,
    pendingMealOpsCleared: pendingBefore,
  }
}
