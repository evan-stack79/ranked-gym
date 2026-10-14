/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const pushCloudBackup = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-tca' as string | null)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => getActiveCloudUserId(),
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

vi.mock('./cloudBackup', () => ({
  pushCloudBackup: (...args: unknown[]) => pushCloudBackup(...args),
  notifyLocalDataChanged: vi.fn(),
}))

describe('eraseAllUserMeals — serveur + local + queue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    getActiveCloudUserId.mockReturnValue('user-tca')
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
    pushCloudBackup.mockResolvedValue({ ok: true })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
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

  it('legacy (no Convex) : push cloud vide la copie en ligne', async () => {
    isConvexDomainActive.mockReturnValue(false)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Legacy meal', mealType: 'lunch', calories: 300 })
    expect(countLocalMeals()).toBeGreaterThanOrEqual(1)

    const result = await eraseAllUserMeals()

    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(pushCloudBackup).toHaveBeenCalledWith('user-tca')
    expect(countLocalMeals()).toBe(0)
    expect(result.serverDeleted).toBeGreaterThanOrEqual(1)
  })

  it('legacy offline → refuse avec Connecte-toi pour effacer (pas d’effacement local)', async () => {
    isConvexDomainActive.mockReturnValue(false)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_CONNECT_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Keep offline', mealType: 'snack', calories: 80 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_CONNECT_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(pushCloudBackup).not.toHaveBeenCalled()
  })

  it('legacy non connecté → refuse avec Connecte-toi pour effacer', async () => {
    isConvexDomainActive.mockReturnValue(false)
    getActiveCloudUserId.mockReturnValue(null)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_CONNECT_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Unsigned', mealType: 'breakfast', calories: 100 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_CONNECT_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(pushCloudBackup).not.toHaveBeenCalled()
  })
})
