/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => 'user-a',
}))

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

describe('localMealSyncState', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('compte synced vs pending upsert', async () => {
    const { addMealToToday, getTodayJournal } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp } = await import('./convexNutritionQueue')
    const { countPendingUnsyncedMeals, countSyncedLocalMeals } = await import(
      './localMealSyncState'
    )

    addMealToToday({ name: 'Synced1', mealType: 'breakfast', calories: 100 })
    addMealToToday({ name: 'Synced2', mealType: 'lunch', calories: 200 })
    const pendingMeal = getTodayJournal().meals[0]
    // Re-add as pending upsert only for one id — simulate one still in queue
    enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-10-14',
      meal: {
        id: 'pending-only-id',
        name: 'Pending',
        mealType: 'snack',
        calories: 50,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })
    // Also mark one local meal as still pending by enqueueing its id
    if (pendingMeal) {
      enqueueConvexNutritionOp({
        kind: 'meal-upsert',
        dateKey: '2026-10-14',
        meal: pendingMeal,
        updatedAt: Date.now(),
      })
    }

    expect(countPendingUnsyncedMeals('user-a')).toBeGreaterThanOrEqual(1)
    // At least one local meal without pending upsert counts as synced
    expect(countSyncedLocalMeals('user-a')).toBeGreaterThanOrEqual(1)
  })
})
