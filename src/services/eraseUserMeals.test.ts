/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const isConvexDomainActive = vi.fn(() => true)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => 'user-tca',
}))

vi.mock('./convexNutritionService', () => ({
  deleteAllMyMealsViaConvex: (...args: unknown[]) => deleteAllMyMealsViaConvex(...args),
  countActiveMealsViaConvex: (...args: unknown[]) => countActiveMealsViaConvex(...args),
  pushConvexMeal: vi.fn().mockResolvedValue({ applied: true, stale: false, updatedAt: 1 }),
  deleteConvexMeal: vi.fn().mockResolvedValue({ applied: true, stale: false, updatedAt: 1 }),
  pushConvexWaterEntry: vi.fn(),
  deleteConvexWaterEntry: vi.fn(),
  pushConvexDayState: vi.fn(),
}))

describe('eraseAllUserMeals — serveur + local + queue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
  })

  it('compte TCA : voit le count, efface tout, serveur + local + pending = 0', async () => {
    const { addMealToToday, countLocalMeals, getTodayJournal } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp, countQueuedMealOpsForUser, __testReadNutritionQueue } =
      await import('./convexNutritionQueue')
    const { eraseAllUserMeals, fetchStoredMealsCount } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Skyr', mealType: 'breakfast', calories: 120 })
    addMealToToday({ name: 'Pomme', mealType: 'snack', calories: 52 })
    // Pending offline meal write (en plus des upserts auto du journal)
    enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-10-14',
      meal: {
        id: 'pending-1',
        name: 'Offline pending',
        mealType: 'lunch',
        calories: 400,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })

    expect(countLocalMeals()).toBeGreaterThanOrEqual(2)
    expect(countQueuedMealOpsForUser('user-tca')).toBeGreaterThanOrEqual(1)
    expect(await fetchStoredMealsCount()).toBeGreaterThanOrEqual(2)

    const result = await eraseAllUserMeals()

    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
    expect(result.serverDeleted).toBe(3)
    expect(countLocalMeals()).toBe(0)
    expect(getTodayJournal().meals).toHaveLength(0)
    expect(countQueuedMealOpsForUser('user-tca')).toBe(0)
    expect(__testReadNutritionQueue('user-tca').some((op) => op.kind.startsWith('meal'))).toBe(
      false,
    )
  })

  it('bouton masqué quand count = 0 (fetchStoredMealsCount)', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    const { fetchStoredMealsCount } = await import('./eraseUserMeals')
    expect(await fetchStoredMealsCount()).toBe(0)
  })

  it('pending offline meal + delete-all → après reconnect local et server à 0', async () => {
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const {
      enqueueConvexNutritionOp,
      countQueuedMealOpsForUser,
      flushConvexNutritionQueue,
    } = await import('./convexNutritionQueue')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Pending burger', mealType: 'dinner', calories: 700 })
    enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-10-14',
      meal: {
        id: 'offline-meal',
        name: 'Pending burger',
        mealType: 'dinner',
        calories: 700,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })

    await eraseAllUserMeals()

    // Reconnect / flush : plus aucune op repas → pushConvexMeal ne sera pas rappelé.
    await flushConvexNutritionQueue()
    expect(countLocalMeals()).toBe(0)
    expect(countQueuedMealOpsForUser('user-tca')).toBe(0)
    // deleteAll déjà appelé ; aucun meal-upsert restant ne peut recréer le repas.
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalledTimes(1)
  })
})
