/** @vitest-environment jsdom */
/**
 * PC-03 file : refus définitif → liste refusés, suite continue ;
 * erreur passagère → backoff, stop tour, pas « refusée ».
 */
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushConvexMeal = vi.fn()
const pushConvexWaterEntry = vi.fn()
const deleteConvexMeal = vi.fn()
const deleteConvexWaterEntry = vi.fn()
const pushConvexDayState = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-queue-pc' as string | null)

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => getActiveCloudUserId(),
}))

vi.mock('./convexNutritionService', () => ({
  pushConvexMeal: (...args: unknown[]) => pushConvexMeal(...args),
  pushConvexWaterEntry: (...args: unknown[]) => pushConvexWaterEntry(...args),
  deleteConvexMeal: (...args: unknown[]) => deleteConvexMeal(...args),
  deleteConvexWaterEntry: (...args: unknown[]) => deleteConvexWaterEntry(...args),
  pushConvexDayState: (...args: unknown[]) => pushConvexDayState(...args),
}))

vi.mock('./nutritionStorage', () => ({
  getJournalForDate: () => ({
    dateKey: '2026-10-15',
    meals: [{ id: 'meal-bad', name: 'X', mealType: 'lunch', calories: 1, createdAt: 1 }],
    waterMl: 0,
    waterEntries: [],
  }),
  saveJournalForDate: vi.fn(),
}))

import {
  __testReadNutritionQueue,
  __testReadRejectedQueue,
  __testWriteNutritionQueue,
  flushConvexNutritionQueue,
  isPermanentConvexQueueError,
} from './convexNutritionQueue'
import { saveJournalForDate } from './nutritionStorage'

const USER = 'user-queue-pc'

describe('convexNutritionQueue — refus définitif vs passager', () => {
  beforeEach(() => {
    localStorage.clear()
    pushConvexMeal.mockReset()
    pushConvexWaterEntry.mockReset()
    deleteConvexMeal.mockReset()
    deleteConvexWaterEntry.mockReset()
    pushConvexDayState.mockReset()
    vi.mocked(saveJournalForDate).mockClear()
    getActiveCloudUserId.mockReturnValue(USER)
  })

  it('isPermanentConvexQueueError : FOOD_ADD_* oui ; Failed to fetch non', () => {
    expect(
      isPermanentConvexQueueError(
        new ConvexError({ code: 'FOOD_ADD_QUANTITY_INVALID', reason: 'above_max', unit: 'g' }),
      ),
    ).toBe(true)
    expect(
      isPermanentConvexQueueError(
        new ConvexError({ code: 'FOOD_ADD_ACCESS_DENIED_MINOR' }),
      ),
    ).toBe(true)
    expect(isPermanentConvexQueueError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isPermanentConvexQueueError(new Error('timeout'))).toBe(false)
    // AGE_REQUIRED = passager (âge peut être complété).
    expect(
      isPermanentConvexQueueError(
        new ConvexError({ code: 'FOOD_ADD_ACCESS_AGE_REQUIRED' }),
      ),
    ).toBe(false)
    expect(
      isPermanentConvexQueueError(new ConvexError({ code: 'age_required' })),
    ).toBe(false)
  })

  it('file [ok, refusé, ok] : 2 envoyés, 1 dans refusés — suite continue', async () => {
    pushConvexMeal
      .mockResolvedValueOnce({ applied: true })
      .mockRejectedValueOnce(
        new ConvexError({ code: 'FOOD_ADD_QUANTITY_INVALID', reason: 'invalid', unit: 'g' }),
      )
      .mockResolvedValueOnce({ applied: true })

    __testWriteNutritionQueue(USER, [
      {
        id: 'op-ok-1',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-ok-1',
          name: 'A',
          mealType: 'lunch',
          calories: 100,
          createdAt: 1,
        },
        updatedAt: 1,
        enqueuedAt: 1,
      },
      {
        id: 'op-bad',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-bad',
          name: 'B',
          mealType: 'lunch',
          calories: 100,
          grams: 0,
          createdAt: 1,
        },
        updatedAt: 2,
        enqueuedAt: 2,
      },
      {
        id: 'op-ok-2',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-ok-2',
          name: 'C',
          mealType: 'lunch',
          calories: 100,
          createdAt: 1,
        },
        updatedAt: 3,
        enqueuedAt: 3,
      },
    ])

    await flushConvexNutritionQueue()

    expect(pushConvexMeal).toHaveBeenCalledTimes(3)
    expect(__testReadNutritionQueue(USER)).toHaveLength(0)
    const rejected = __testReadRejectedQueue(USER)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.code).toBe('FOOD_ADD_QUANTITY_INVALID')
    expect(rejected[0]!.mealId).toBe('meal-bad')
  })

  it('erreur passagère : garde la file, aucun refusés, stop ce tour', async () => {
    pushConvexMeal.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    pushConvexWaterEntry.mockResolvedValue({ applied: true })

    __testWriteNutritionQueue(USER, [
      {
        id: 'op-offline',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-off',
          name: 'Offline',
          mealType: 'lunch',
          calories: 100,
          grams: 120,
          createdAt: 1,
        },
        updatedAt: 1,
        enqueuedAt: 1,
      },
      {
        id: 'op-water',
        kind: 'water-upsert',
        dateKey: '2026-10-15',
        entry: {
          id: 'w1',
          amountMl: 250,
          type: 'glass',
          label: 'Verre',
          createdAt: 1,
        },
        updatedAt: 2,
        enqueuedAt: 2,
      },
    ])

    await flushConvexNutritionQueue()

    expect(pushConvexMeal).toHaveBeenCalledTimes(1)
    expect(pushConvexWaterEntry).not.toHaveBeenCalled()
    const queue = __testReadNutritionQueue(USER)
    expect(queue).toHaveLength(2)
    expect(queue[0]!.id).toBe('op-offline')
    expect(queue[0]!.attempts).toBe(1)
    expect(queue[0]!.nextAttemptAt).toBeGreaterThan(Date.now())
    expect(__testReadRejectedQueue(USER)).toHaveLength(0)
  })

  it('FOOD_ADD_ACCESS_AGE_REQUIRED : passager — op reste, pas syncRejected', async () => {
    pushConvexMeal.mockRejectedValueOnce(
      new ConvexError({ code: 'FOOD_ADD_ACCESS_AGE_REQUIRED' }),
    )
    __testWriteNutritionQueue(USER, [
      {
        id: 'op-age',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-bad',
          name: 'Age',
          mealType: 'lunch',
          calories: 100,
          grams: 100,
          createdAt: 1,
        },
        updatedAt: 1,
        enqueuedAt: 1,
      },
    ])
    await flushConvexNutritionQueue()
    const queue = __testReadNutritionQueue(USER)
    expect(queue).toHaveLength(1)
    expect(queue[0]!.id).toBe('op-age')
    expect(queue[0]!.attempts).toBe(1)
    expect(__testReadRejectedQueue(USER)).toHaveLength(0)
    expect(saveJournalForDate).not.toHaveBeenCalled()
  })

  it('FOOD_ADD_ACCESS_DENIED_MINOR : définitif — refusés + syncRejected', async () => {
    pushConvexMeal.mockRejectedValueOnce(
      new ConvexError({ code: 'FOOD_ADD_ACCESS_DENIED_MINOR' }),
    )
    __testWriteNutritionQueue(USER, [
      {
        id: 'op-minor',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-bad',
          name: 'Minor',
          mealType: 'lunch',
          calories: 100,
          grams: 100,
          createdAt: 1,
        },
        updatedAt: 1,
        enqueuedAt: 1,
      },
    ])
    await flushConvexNutritionQueue()
    expect(__testReadNutritionQueue(USER)).toHaveLength(0)
    const rejected = __testReadRejectedQueue(USER)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.code).toBe('FOOD_ADD_ACCESS_DENIED_MINOR')
    expect(saveJournalForDate).toHaveBeenCalled()
    const saved = vi.mocked(saveJournalForDate).mock.calls[0]![0] as {
      meals: Array<{ syncRejected?: boolean }>
    }
    expect(saved.meals.some((m) => m.syncRejected === true)).toBe(true)
  })
})
