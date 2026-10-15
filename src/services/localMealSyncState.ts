/**
 * Distingue repas locaux déjà synchronisés vs pending (pas encore envoyés).
 */
import { getActiveCloudUserId } from './cloudSession'
import { pendingMealUpsertIdsForUser } from './convexNutritionQueue'
import { getMealJournal } from './nutritionStorage'

/** Nombre d’upsert repas pending (affichage « pas encore envoyés »). */
export function countPendingUnsyncedMeals(userId?: string | null): number {
  const uid = userId ?? getActiveCloudUserId()
  if (!uid) return 0
  return pendingMealUpsertIdsForUser(uid).size
}

/**
 * Repas dans le journal local dont l’id n’est PAS en pending upsert
 * → considérés déjà sync online.
 */
export function countSyncedLocalMeals(userId?: string | null): number {
  const uid = userId ?? getActiveCloudUserId()
  if (!uid) return 0
  const pending = pendingMealUpsertIdsForUser(uid)
  let synced = 0
  for (const day of Object.values(getMealJournal())) {
    for (const meal of day.meals ?? []) {
      if (!pending.has(meal.id)) synced += 1
    }
  }
  return synced
}
