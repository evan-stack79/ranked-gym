/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const countSupabaseMealsViaConvex = vi.fn()
const purgeSupabaseMealCopiesViaConvex = vi.fn()
const requireAccountLinkForErase = vi.fn()
const fetchMyAccountLink = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const isConvexConfigured = vi.fn(() => true)
const getActiveCloudUserId = vi.fn(() => 'user-A' as string | null)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
  isActiveCloudBackendConfigured: () => true,
  getActiveCloudBackend: () => (isConvexDomainActive() ? 'convex' : 'supabase'),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
}))

vi.mock('../lib/convex', () => ({
  isConvexConfigured: () => isConvexConfigured(),
  getConvex: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => getActiveCloudUserId(),
}))

vi.mock('./accountLinkService', async () => {
  const actual = await vi.importActual<typeof import('./accountLinkService')>(
    './accountLinkService',
  )
  return {
    ...actual,
    requireAccountLinkForErase: (...args: unknown[]) => requireAccountLinkForErase(...args),
    fetchMyAccountLink: (...args: unknown[]) => fetchMyAccountLink(...args),
  }
})

vi.mock('./convexNutritionService', () => ({
  deleteAllMyMealsViaConvex: (...args: unknown[]) => deleteAllMyMealsViaConvex(...args),
  countActiveMealsViaConvex: (...args: unknown[]) => countActiveMealsViaConvex(...args),
  countSupabaseMealsViaConvex: (...args: unknown[]) => countSupabaseMealsViaConvex(...args),
  purgeSupabaseMealCopiesViaConvex: (...args: unknown[]) =>
    purgeSupabaseMealCopiesViaConvex(...args),
  pushConvexMeal: vi.fn().mockResolvedValue({ applied: true, stale: false, updatedAt: 1 }),
  deleteConvexMeal: vi.fn().mockResolvedValue({ applied: true, stale: false, updatedAt: 1 }),
  pushConvexWaterEntry: vi.fn(),
  deleteConvexWaterEntry: vi.fn(),
  pushConvexDayState: vi.fn(),
}))

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
  pushCloudBackup: vi.fn(),
}))

describe('eraseAllUserMeals — B8', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    isConvexConfigured.mockReturnValue(true)
    getActiveCloudUserId.mockReturnValue('user-A')
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
    countSupabaseMealsViaConvex.mockResolvedValue(0)
    fetchMyAccountLink.mockResolvedValue({
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
      linkedAt: 1,
    })
    requireAccountLinkForErase.mockResolvedValue({
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
      linkedAt: 1,
    })
    purgeSupabaseMealCopiesViaConvex.mockResolvedValue({
      deletedCount: 0,
      nutritionStatus: 'absent',
      userBackupsStatus: 'absent',
      resolvedUserId: 'supabase-A',
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('efface Convex + local ; chemin serveur Supabase', async () => {
    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Skyr', mealType: 'breakfast', calories: 120 })
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(3)
    expect(countLocalMeals()).toBe(0)
    expect(requireAccountLinkForErase).toHaveBeenCalled()
    expect(purgeSupabaseMealCopiesViaConvex).toHaveBeenCalled()
  })

  it('B8-01 permanent : Supabase B, app A → erreur, rien effacé', async () => {
    // Legacy domain off, but same server path — phone session B mismatches link A
    isConvexDomainActive.mockReturnValue(false)
    const { EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import(
      './purgeSupabaseMealCopies'
    )
    requireAccountLinkForErase.mockRejectedValue(
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
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(requireAccountLinkForErase).toHaveBeenCalled()
  })

  it('B7 : sans lien → reconnect, rien effacé', async () => {
    const { EraseMealsNeedsLegacyReconnectError, ERASE_MEALS_RECONNECT_LEGACY_MESSAGE } =
      await import('./accountLinkService')
    requireAccountLinkForErase.mockRejectedValue(new EraseMealsNeedsLegacyReconnectError())

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Meal of A', mealType: 'lunch', calories: 300 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
  })

  it('Supabase pausé → message purge, téléphone intact, Convex non effacé', async () => {
    purgeSupabaseMealCopiesViaConvex.mockRejectedValue(new Error('ERASE_MEALS_PURGE_FAILED'))

    const { addMealToToday, countLocalMeals, getTodayJournal } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./eraseUserMeals')

    addMealToToday({ name: 'Kept locally', mealType: 'lunch', calories: 250 })
    const before = countLocalMeals()
    const nameBefore = getTodayJournal().meals[0]?.name

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(getTodayJournal().meals[0]?.name).toBe(nameBefore)
    expect(purgeSupabaseMealCopiesViaConvex).toHaveBeenCalled()
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
  })

  it('B8-03 : 0 Convex + 3 Supabase → count 3, erase', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    countSupabaseMealsViaConvex.mockResolvedValue(3)
    purgeSupabaseMealCopiesViaConvex.mockResolvedValue({
      deletedCount: 3,
      nutritionStatus: 'purged',
      userBackupsStatus: 'absent',
      resolvedUserId: 'supabase-A',
    })

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, fetchMealsEraseCardState } = await import('./eraseUserMeals')

    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBe(3)
    expect(state.needsLegacyReconnect).toBe(false)

    addMealToToday({ name: 'Local cache', mealType: 'snack', calories: 10 })
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(3)
    expect(countLocalMeals()).toBe(0)
    expect(purgeSupabaseMealCopiesViaConvex).toHaveBeenCalled()
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
  })

  it('B6-02 : serveur 0 + 5 synced locaux → erreur, rien effacé', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    countSupabaseMealsViaConvex.mockResolvedValue(0)
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
    countSupabaseMealsViaConvex.mockResolvedValue(0)
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
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
    expect(countLocalMeals()).toBe(0)
    expect(countQueuedMealOpsForUser('user-A')).toBe(0)
  })

  it('B6-03 : fetchMealsEraseCardState — count Convex+Supabase + pending', async () => {
    countActiveMealsViaConvex.mockResolvedValue(4)
    countSupabaseMealsViaConvex.mockResolvedValue(2)
    const { enqueueConvexNutritionOp } = await import('./convexNutritionQueue')
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')

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
    expect(state.serverCount).toBe(6)
    expect(state.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('serveur muet → serverCount null', async () => {
    countSupabaseMealsViaConvex.mockRejectedValue(new Error('down'))
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')
    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBeNull()
  })
})
