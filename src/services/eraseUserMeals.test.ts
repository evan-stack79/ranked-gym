/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const isSupabaseConfigured = vi.fn(() => false)
const purgeSupabaseMealCopies = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-tca' as string | null)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
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

vi.mock('./purgeSupabaseMealCopies', async () => {
  const actual = await vi.importActual<typeof import('./purgeSupabaseMealCopies')>(
    './purgeSupabaseMealCopies',
  )
  return {
    ...actual,
    purgeSupabaseMealCopies: (...args: unknown[]) => purgeSupabaseMealCopies(...args),
  }
})

describe('eraseAllUserMeals — serveur + local + queue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(false)
    getActiveCloudUserId.mockReturnValue('user-tca')
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
    purgeSupabaseMealCopies.mockResolvedValue({
      nutritionPurged: true,
      userBackupsPurged: true,
      skipped: false,
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('compte TCA : voit le count, efface tout, serveur + local + pending = 0', async () => {
    const { addMealToToday, countLocalMeals, getTodayJournal } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp, countQueuedMealOpsForUser, __testReadNutritionQueue } =
      await import('./convexNutritionQueue')
    const { eraseAllUserMeals, fetchStoredMealsCount } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Skyr', mealType: 'breakfast', calories: 120 })
    addMealToToday({ name: 'Pomme', mealType: 'snack', calories: 52 })
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

    await flushConvexNutritionQueue()
    expect(countLocalMeals()).toBe(0)
    expect(countQueuedMealOpsForUser('user-tca')).toBe(0)
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalledTimes(1)
  })

  it('Convex + Supabase configuré : purge les deux avant de vider le local', async () => {
    isSupabaseConfigured.mockReturnValue(true)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Dual store', mealType: 'lunch', calories: 300 })
    await eraseAllUserMeals()

    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
    expect(purgeSupabaseMealCopies).toHaveBeenCalledWith('user-tca')
    expect(countLocalMeals()).toBe(0)
  })

  it('legacy (no Convex) : purge Supabase nutrition + user_backups', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Legacy meal', mealType: 'lunch', calories: 300 })
    const result = await eraseAllUserMeals()

    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(purgeSupabaseMealCopies).toHaveBeenCalledWith('user-tca')
    expect(countLocalMeals()).toBe(0)
    expect(result.serverDeleted).toBeGreaterThanOrEqual(1)
  })

  it('Supabase injoignable → échec, local intact, retryable', async () => {
    isSupabaseConfigured.mockReturnValue(true)
    const { EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import(
      './purgeSupabaseMealCopies'
    )
    purgeSupabaseMealCopies.mockRejectedValue(
      new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE),
    )

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Keep on fail', mealType: 'snack', calories: 80 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('offline → refuse avec Connecte-toi pour effacer (pas d’effacement local)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_CONNECT_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Keep offline', mealType: 'snack', calories: 80 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_CONNECT_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(purgeSupabaseMealCopies).not.toHaveBeenCalled()
  })

  it('non connecté → refuse avec Connecte-toi pour effacer', async () => {
    getActiveCloudUserId.mockReturnValue(null)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_CONNECT_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Unsigned', mealType: 'breakfast', calories: 100 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_CONNECT_MESSAGE)
    expect(countLocalMeals()).toBe(before)
  })
})
