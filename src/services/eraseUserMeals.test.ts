/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const purgeSupabaseMealCopiesViaConvex = vi.fn()
const countActiveMealsViaSupabase = vi.fn()
const assertAccountLinkForErase = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const isConvexConfigured = vi.fn(() => true)
const isSupabaseConfigured = vi.fn(() => false)
const purgeSupabaseMealCopies = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-A' as string | null)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
  isActiveCloudBackendConfigured: () => true,
  getActiveCloudBackend: () => (isConvexDomainActive() ? 'convex' : 'supabase'),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}))

vi.mock('../lib/convex', () => ({
  isConvexConfigured: () => isConvexConfigured(),
  getConvex: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => getActiveCloudUserId(),
}))

vi.mock('./accountLinkService', () => ({
  assertAccountLinkForErase: (...args: unknown[]) => assertAccountLinkForErase(...args),
}))

vi.mock('./countSupabaseMeals', () => ({
  countActiveMealsViaSupabase: (...args: unknown[]) => countActiveMealsViaSupabase(...args),
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

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
  pushCloudBackup: vi.fn(),
}))

describe('eraseAllUserMeals — B6', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    isConvexConfigured.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(false)
    getActiveCloudUserId.mockReturnValue('user-A')
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
    countActiveMealsViaSupabase.mockResolvedValue(0)
    assertAccountLinkForErase.mockResolvedValue({
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })
    purgeSupabaseMealCopiesViaConvex.mockResolvedValue({
      deletedCount: 0,
      nutritionStatus: 'absent',
      userBackupsStatus: 'absent',
      resolvedUserId: 'user-A',
    })
    purgeSupabaseMealCopies.mockResolvedValue({
      deletedCount: 2,
      nutritionStatus: 'purged',
      userBackupsStatus: 'purged',
      resolvedUserId: 'supabase-A',
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('efface Convex + local ; deletedCount serveur', async () => {
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Skyr', mealType: 'breakfast', calories: 120 })
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(3)
    expect(countLocalMeals()).toBe(0)
  })

  it('B6-01 legacy : Supabase B / app A → erreur, repas A locaux intacts, purge B non appelée', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    const { EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import(
      './purgeSupabaseMealCopies'
    )
    assertAccountLinkForErase.mockRejectedValue(
      new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE),
    )

    const { addMealToToday, countLocalMeals, getTodayJournal } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Meal of A', mealType: 'lunch', calories: 300 })
    const before = countLocalMeals()
    const nameBefore = getTodayJournal().meals[0]?.name

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(getTodayJournal().meals[0]?.name).toBe(nameBefore)
    expect(purgeSupabaseMealCopies).not.toHaveBeenCalled()
    expect(assertAccountLinkForErase).toHaveBeenCalledWith('user-A')
  })

  it('B6-02 : serveur 0 + 5 synced locaux → erreur, rien effacé', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    // Ajout hors Convex → pas d’enqueue pending ; repas = déjà sync online
    isConvexDomainActive.mockReturnValue(false)
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { clearQueuedMealOpsForUser } = await import('./convexNutritionQueue')
    const { countSyncedLocalMeals } = await import('./localMealSyncState')

    for (let i = 0; i < 5; i += 1) {
      addMealToToday({ name: `Synced ${i}`, mealType: 'snack', calories: 10 + i })
    }
    clearQueuedMealOpsForUser('user-A')
    isConvexDomainActive.mockReturnValue(true)

    const { eraseAllUserMeals, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./eraseUserMeals')
    expect(countLocalMeals()).toBe(5)
    expect(countSyncedLocalMeals('user-A')).toBe(5)

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(5)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
  })

  it('B6-02 : serveur 0 + pending-only → efface local sans purge online', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    const { countLocalMeals } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp, countQueuedMealOpsForUser } =
      await import('./convexNutritionQueue')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')

    enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-10-14',
      meal: {
        id: 'pending-1',
        name: 'Offline only',
        mealType: 'dinner',
        calories: 400,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })
    expect(countQueuedMealOpsForUser('user-A')).toBeGreaterThanOrEqual(1)

    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(0)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(countLocalMeals()).toBe(0)
    expect(countQueuedMealOpsForUser('user-A')).toBe(0)
  })

  it('B6-03 : fetchMealsEraseCardState — count serveur only + pending séparé', async () => {
    countActiveMealsViaConvex.mockResolvedValue(4)
    const { addMealToToday } = await import('./nutritionStorage')
    const { enqueueConvexNutritionOp } = await import('./convexNutritionQueue')
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Local extra', mealType: 'lunch', calories: 1 })
    enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-10-14',
      meal: {
        id: 'p1',
        name: 'Pending',
        mealType: 'snack',
        calories: 1,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })

    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBe(4)
    expect(state.pendingCount).toBeGreaterThanOrEqual(1)
    // Ne doit pas être max(local, server)
    expect(state.serverCount).not.toBe(5)
  })

  it('B6-03 : serveur muet → serverCount null', async () => {
    countActiveMealsViaConvex.mockRejectedValue(new Error('down'))
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')
    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBeNull()
  })

  it('legacy serveur count via Supabase', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)
    countActiveMealsViaSupabase.mockResolvedValue(9)
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')
    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBe(9)
    expect(countActiveMealsViaSupabase).toHaveBeenCalled()
  })
})
