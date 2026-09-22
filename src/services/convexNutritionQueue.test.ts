import { beforeEach, describe, expect, it, vi } from 'vitest'

const getActiveCloudUserId = vi.fn()
const pushConvexMeal = vi.fn()
const deleteConvexMeal = vi.fn()
const pushConvexWaterEntry = vi.fn()
const deleteConvexWaterEntry = vi.fn()
const pushConvexDayState = vi.fn()
const notifyLocalDataChanged = vi.fn()
const safeError = vi.fn()
const safeWarn = vi.fn()

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId,
}))

vi.mock('./convexNutritionService', () => ({
  pushConvexMeal,
  deleteConvexMeal,
  pushConvexWaterEntry,
  deleteConvexWaterEntry,
  pushConvexDayState,
}))

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged,
}))

vi.mock('../utils/safeLog', () => ({
  safeError,
  safeWarn,
}))

describe('convexNutritionQueue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getActiveCloudUserId.mockReturnValue('user-a')
    localStorage.clear()
  })

  it('queues + flushes meal upsert operations', async () => {
    pushConvexMeal.mockResolvedValue({ applied: true, stale: false, updatedAt: Date.now() })
    const queue = await import('./convexNutritionQueue')
    queue.enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-09-22',
      meal: {
        id: 'meal-1',
        mealType: 'lunch',
        name: 'Poulet Riz',
        calories: 620,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })
    await queue.flushConvexNutritionQueue()

    expect(pushConvexMeal).toHaveBeenCalledTimes(1)
    expect(queue.getQueuedConvexNutritionOpCount()).toBe(0)
  })

  it('keeps operations queued and triggers fallback push on convex outage', async () => {
    pushConvexMeal.mockRejectedValue(new Error('network timeout'))
    const queue = await import('./convexNutritionQueue')
    queue.enqueueConvexNutritionOp({
      kind: 'meal-upsert',
      dateKey: '2026-09-22',
      meal: {
        id: 'meal-2',
        mealType: 'dinner',
        name: 'Saumon',
        calories: 540,
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    })

    await queue.flushConvexNutritionQueue()

    expect(queue.getQueuedConvexNutritionOpCount()).toBe(1)
    expect(notifyLocalDataChanged).toHaveBeenCalledTimes(1)
    expect(safeError).toHaveBeenCalled()
  })

  it('flushes water and day-state operations', async () => {
    pushConvexWaterEntry.mockResolvedValue({ applied: true, stale: false, updatedAt: Date.now() })
    deleteConvexWaterEntry.mockResolvedValue({ applied: true, stale: false, updatedAt: Date.now() })
    pushConvexDayState.mockResolvedValue({ applied: true, stale: false, updatedAt: Date.now() })

    const queue = await import('./convexNutritionQueue')
    queue.enqueueConvexNutritionOp({
      kind: 'water-upsert',
      dateKey: '2026-09-22',
      entry: {
        id: 'w-1',
        amountMl: 250,
        createdAt: Date.now(),
        label: 'Verre',
        type: 'glass',
      },
      updatedAt: Date.now(),
    })
    queue.enqueueConvexNutritionOp({
      kind: 'water-delete',
      dateKey: '2026-09-22',
      entryId: 'w-old',
      deletedAt: Date.now(),
    })
    queue.enqueueConvexNutritionOp({
      kind: 'day-state-upsert',
      dateKey: '2026-09-22',
      dayState: {
        waterBottleLevelMl: 700,
        waterBottleCalibrationTotalMl: 1200,
      },
      updatedAt: Date.now(),
    })

    await queue.flushConvexNutritionQueue()

    expect(pushConvexWaterEntry).toHaveBeenCalledTimes(1)
    expect(deleteConvexWaterEntry).toHaveBeenCalledTimes(1)
    expect(pushConvexDayState).toHaveBeenCalledTimes(1)
    expect(queue.getQueuedConvexNutritionOpCount()).toBe(0)
  })

  it('does nothing when there is no active user', async () => {
    getActiveCloudUserId.mockReturnValue(null)
    const queue = await import('./convexNutritionQueue')
    queue.enqueueConvexNutritionOp({
      kind: 'meal-delete',
      dateKey: '2026-09-22',
      mealId: 'meal-x',
      deletedAt: Date.now(),
    })
    await queue.flushConvexNutritionQueue()

    expect(queue.getQueuedConvexNutritionOpCount()).toBe(0)
    expect(deleteConvexMeal).not.toHaveBeenCalled()
  })
})
