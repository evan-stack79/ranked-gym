/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAllMyMealsViaConvex = vi.fn()
const countActiveMealsViaConvex = vi.fn()
const countSupabaseMealsViaConvex = vi.fn()
const listActiveMealIdsViaConvex = vi.fn()
const listSupabaseMealIdsViaConvex = vi.fn()
const purgeSupabaseMealCopiesViaConvex = vi.fn()
const purgeSupabaseMealCopiesByAccessTokenViaConvex = vi.fn()
const countSupabaseMealsByAccessTokenViaConvex = vi.fn()
const requireAccountLinkForErase = vi.fn()
const fetchMyAccountLink = vi.fn()
const isConvexDomainActive = vi.fn(() => true)
const isConvexConfigured = vi.fn(() => true)
const getActiveCloudUserId = vi.fn(() => 'user-A' as string | null)
const getSupabase = vi.fn()
const isSupabaseConfigured = vi.fn(() => false)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => isConvexDomainActive(),
  isActiveCloudBackendConfigured: () => true,
  getActiveCloudBackend: () => (isConvexDomainActive() ? 'convex' : 'supabase'),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  getSupabase: () => getSupabase(),
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
  listActiveMealIdsViaConvex: (...args: unknown[]) => listActiveMealIdsViaConvex(...args),
  listSupabaseMealIdsViaConvex: (...args: unknown[]) => listSupabaseMealIdsViaConvex(...args),
  purgeSupabaseMealCopiesViaConvex: (...args: unknown[]) =>
    purgeSupabaseMealCopiesViaConvex(...args),
  purgeSupabaseMealCopiesByAccessTokenViaConvex: (...args: unknown[]) =>
    purgeSupabaseMealCopiesByAccessTokenViaConvex(...args),
  countSupabaseMealsByAccessTokenViaConvex: (...args: unknown[]) =>
    countSupabaseMealsByAccessTokenViaConvex(...args),
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

describe('eraseAllUserMeals — B8/B9', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    isConvexDomainActive.mockReturnValue(true)
    isConvexConfigured.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(false)
    getActiveCloudUserId.mockReturnValue('user-A')
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    })
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 3, updatedAt: 1 })
    countActiveMealsViaConvex.mockResolvedValue(3)
    countSupabaseMealsViaConvex.mockResolvedValue(0)
    listActiveMealIdsViaConvex.mockResolvedValue(['m1', 'm2', 'm3'])
    listSupabaseMealIdsViaConvex.mockResolvedValue([])
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
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('B8-01 permanent : Supabase B, app A → erreur, rien effacé', async () => {
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
    fetchMyAccountLink.mockResolvedValue(null)
    const { EraseMealsNeedsLegacyReconnectError, ERASE_MEALS_RECONNECT_LEGACY_MESSAGE } =
      await import('./accountLinkService')

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Meal of A', mealType: 'lunch', calories: 300 })
    const before = countLocalMeals()

    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
    expect(EraseMealsNeedsLegacyReconnectError).toBeTruthy()
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

  it('Supabase pausé / unreachable → message purge, téléphone intact, Convex non effacé', async () => {
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

  it('clé service-role absente côté serveur → même fail-closed local', async () => {
    purgeSupabaseMealCopiesViaConvex.mockRejectedValue(new Error('ERASE_MEALS_PURGE_FAILED'))

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { EraseMealsPurgeError } = await import('./purgeSupabaseMealCopies')
    const { eraseAllUserMeals, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Still here', mealType: 'dinner', calories: 400 })
    const before = countLocalMeals()

    let caught: unknown
    try {
      await eraseAllUserMeals()
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(EraseMealsPurgeError)
    expect((caught as Error).message).toBe(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(deleteAllMyMealsViaConvex).not.toHaveBeenCalled()
  })

  it('B8-03 : 0 Convex + 3 Supabase → count 3, erase', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    countSupabaseMealsViaConvex.mockResolvedValue(3)
    listActiveMealIdsViaConvex.mockResolvedValue([])
    listSupabaseMealIdsViaConvex.mockResolvedValue(['s1', 's2', 's3'])
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 0, updatedAt: 1 })
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
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('B8-03 : 0 Convex + 3 Supabase → count 3, erase ; B9-04 backups Convex appelés', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    countSupabaseMealsViaConvex.mockResolvedValue(3)
    listActiveMealIdsViaConvex.mockResolvedValue([])
    listSupabaseMealIdsViaConvex.mockResolvedValue(['s1', 's2', 's3'])
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 0, updatedAt: 1 })
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
    // B9-04 : toujours nettoyer backups Convex même à 0 repas Convex.
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('B9-03 : 5+5 mêmes meal ids → count 5 pas 10', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    listActiveMealIdsViaConvex.mockResolvedValue(ids)
    listSupabaseMealIdsViaConvex.mockResolvedValue(ids)
    const { dedupeMealCountByIds, fetchMealsEraseCardState } = await import('./eraseUserMeals')
    expect(dedupeMealCountByIds(ids, ids)).toBe(5)
    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBe(5)
  })

  it('B9-04 : 0 Convex meals → deleteAllMyMeals quand même (backups)', async () => {
    listActiveMealIdsViaConvex.mockResolvedValue([])
    listSupabaseMealIdsViaConvex.mockResolvedValue([])
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 0, updatedAt: 1 })
    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(0)
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('Supabase-only : efface ses repas via token, jamais un autre', async () => {
    fetchMyAccountLink.mockResolvedValue(null)
    isSupabaseConfigured.mockReturnValue(true)
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'token-of-A' } },
          error: null,
        }),
      },
    })
    countSupabaseMealsByAccessTokenViaConvex.mockResolvedValue({
      count: 2,
      mealIds: ['x', 'y'],
      resolvedUserId: 'supabase-A',
    })
    purgeSupabaseMealCopiesByAccessTokenViaConvex.mockResolvedValue({
      deletedCount: 2,
      nutritionStatus: 'purged',
      userBackupsStatus: 'absent',
      resolvedUserId: 'supabase-A',
    })
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 0, updatedAt: 1 })

    const { eraseAllUserMeals } = await import('./eraseUserMeals')
    const result = await eraseAllUserMeals()
    expect(result.serverDeleted).toBe(2)
    expect(purgeSupabaseMealCopiesByAccessTokenViaConvex).toHaveBeenCalledWith('token-of-A')
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
    // Token path only — no arbitrary userId argument.
    expect(purgeSupabaseMealCopiesByAccessTokenViaConvex.mock.calls[0]).toEqual(['token-of-A'])
  })

  it('Supabase-only token fake → refuse, rien effacé', async () => {
    fetchMyAccountLink.mockResolvedValue(null)
    isSupabaseConfigured.mockReturnValue(true)
    getSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'fake' } },
          error: null,
        }),
      },
    })
    countSupabaseMealsByAccessTokenViaConvex.mockRejectedValue(
      new Error('SUPABASE_TOKEN_UNRESOLVED'),
    )

    const { addMealToToday, countLocalMeals } = await import('./nutritionStorage')
    const { eraseAllUserMeals, ERASE_MEALS_PURGE_FAILED_MESSAGE } = await import('./eraseUserMeals')
    addMealToToday({ name: 'Keep', mealType: 'lunch', calories: 1 })
    const before = countLocalMeals()
    await expect(eraseAllUserMeals()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    expect(countLocalMeals()).toBe(before)
    expect(purgeSupabaseMealCopiesByAccessTokenViaConvex).not.toHaveBeenCalled()
  })

  it('B6-02 : serveur 0 + 5 synced locaux → erreur, rien effacé', async () => {
    countActiveMealsViaConvex.mockResolvedValue(0)
    countSupabaseMealsViaConvex.mockResolvedValue(0)
    listActiveMealIdsViaConvex.mockResolvedValue([])
    listSupabaseMealIdsViaConvex.mockResolvedValue([])
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
    listActiveMealIdsViaConvex.mockResolvedValue([])
    listSupabaseMealIdsViaConvex.mockResolvedValue([])
    deleteAllMyMealsViaConvex.mockResolvedValue({ deletedCount: 0, updatedAt: 1 })
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
    expect(purgeSupabaseMealCopiesViaConvex).not.toHaveBeenCalled()
    expect(countLocalMeals()).toBe(0)
    expect(countQueuedMealOpsForUser('user-A')).toBe(0)
    // B9-04 still cleans Convex backups on the 0-meal path.
    expect(deleteAllMyMealsViaConvex).toHaveBeenCalled()
  })

  it('B6-03 : fetchMealsEraseCardState — count Convex+Supabase + pending', async () => {
    listActiveMealIdsViaConvex.mockResolvedValue(['a', 'b', 'c', 'd'])
    listSupabaseMealIdsViaConvex.mockResolvedValue(['e', 'f'])
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
    // 4 Convex + 2 Supabase distinct = 6
    expect(state.serverCount).toBe(6)
    expect(state.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('B6-03 : fetchMealsEraseCardState — count Convex+Supabase dédup + pending', async () => {
    listActiveMealIdsViaConvex.mockResolvedValue(['a', 'b', 'c', 'd'])
    listSupabaseMealIdsViaConvex.mockResolvedValue(['d', 'e'])
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
    // a,b,c,d,e → 5 (d partagé)
    expect(state.serverCount).toBe(5)
    expect(state.pendingCount).toBeGreaterThanOrEqual(1)
  })

  it('B7 : sans lien → needsLegacyReconnect sur la carte', async () => {
    fetchMyAccountLink.mockResolvedValue(null)
    countActiveMealsViaConvex.mockResolvedValue(5)
    const { fetchMealsEraseCardState, ERASE_MEALS_RECONNECT_LEGACY_MESSAGE } =
      await import('./eraseUserMeals')
    const state = await fetchMealsEraseCardState()
    expect(state.needsLegacyReconnect).toBe(true)
    expect(state.serverCount).toBe(5)
    expect(ERASE_MEALS_RECONNECT_LEGACY_MESSAGE).toMatch(/ancien compte/)
  })

  it('serveur muet → serverCount null', async () => {
    listSupabaseMealIdsViaConvex.mockRejectedValue(new Error('down'))
    const { fetchMealsEraseCardState } = await import('./eraseUserMeals')
    const state = await fetchMealsEraseCardState()
    expect(state.serverCount).toBeNull()
  })
})
