/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const purgeSupabaseMealCopiesViaConvex = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const isSupabaseConfigured = vi.fn(() => false)
const purgeSupabaseMealCopies = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-tca' as string | null)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
  isActiveCloudBackendConfigured: () => true,
  getActiveCloudBackend: () => (isConvexDomainActive() ? 'convex' : 'supabase'),
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
  purgeSupabaseMealCopiesViaConvex: (...args: unknown[]) =>
    purgeSupabaseMealCopiesViaConvex(...args),
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
    purgeSupabaseMealCopiesViaConvex.mockResolvedValue({
      deletedCount: 0,
      nutritionStatus: 'absent',
      userBackupsStatus: 'absent',
      resolvedUserId: 'user-tca',
    })
    purgeSupabaseMealCopies.mockResolvedValue({
      deletedCount: 2,
      nutritionStatus: 'purged',
      userBackupsStatus: 'purged',
      resolvedUserId: 'user-tca',
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('compte TCA : efface serveur + local ; deletedCount vient du serveur', async () => {
    const { addMealToToday, countLocalMeals, getTodayJournal } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp, countQueuedMealOpsForUser } =
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

    expect(await fetchStoredMealsCount()).toBeGreaterThanOrEqual(2)
    const result = await eraseAllUserMeals()

    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
    expect(result.serverDeleted).toBe(3)
    expect(countLocalMeals()).toBe(0)
    expect(getTodayJournal().meals).toHaveLength(0)
    expect(countQueuedMealOpsForUser('user-tca')).toBe(0)
  })

  it('Convex + Supabase : purge Convex action (pas d’id téléphone)', async () => {
    isSupabaseConfigured.mockReturnValue(true)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Dual', mealType: 'lunch', calories: 300 })
    await eraseAllUserMeals()

    expect(purgeSupabaseMealCopiesViaConvex).toHaveBeenCalled()
    expect(purgeSupabaseMealCopies).not.toHaveBeenCalled()
    expect(countLocalMeals()).toBe(0)
  })

  it('legacy : deletedCount serveur ; jamais recopié depuis le count téléphone', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    purgeSupabaseMealCopies.mockResolvedValue({
      deletedCount: 7,
      nutritionStatus: 'purged',
      userBackupsStatus: 'absent',
      resolvedUserId: 'user-tca',
    })
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'A', mealType: 'lunch', calories: 1 })
    addMealToToday({ name: 'B', mealType: 'dinner', calories: 2 })
    // local count = 2, server says 7
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(7)
    expect(result.serverDeleted).not.toBe(countLocalMeals())
    expect(countLocalMeals()).toBe(0)
  })

  it('legacy missing server deletedCount → failure, local intact', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    purgeSupabaseMealCopies.mockResolvedValue({
      deletedCount: undefined,
      nutritionStatus: 'purged',
      userBackupsStatus: 'purged',
      resolvedUserId: 'user-tca',
    })
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Keep', mealType: 'snack', calories: 80 })
    const before = countLocalMeals()
    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
  })

  it('fake Supabase 0 found ambigu → erreur, repas locaux gardés', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    const { EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import(
      './purgeSupabaseMealCopies'
    )
    purgeSupabaseMealCopies.mockRejectedValue(
      new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE),
    )

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Still here', mealType: 'lunch', calories: 100 })
    const before = countLocalMeals()
    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
  })

  it('offline → Connecte-toi pour effacer', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_CONNECT_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Keep offline', mealType: 'snack', calories: 80 })
    const before = countLocalMeals()
    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_CONNECT_MESSAGE)
    expect(countLocalMeals()).toBe(before)
  })
})
