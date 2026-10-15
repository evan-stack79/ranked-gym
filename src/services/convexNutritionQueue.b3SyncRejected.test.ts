/** @vitest-environment jsdom */
/**
 * B3-06 — envoi réussi efface syncRejected ; refusés plafonnés à 50.
 */
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushConvexMeal = vi.fn()
const pushConvexWaterEntry = vi.fn()
const deleteConvexMeal = vi.fn()
const deleteConvexWaterEntry = vi.fn()
const pushConvexDayState = vi.fn()
const getActiveCloudUserId = vi.fn(() => 'user-b3-q' as string | null)

let journalMeals: Array<Record<string, unknown>> = []

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
    meals: journalMeals,
    waterMl: 0,
    waterEntries: [],
  }),
  saveJournalForDate: vi.fn((next: { meals: Array<Record<string, unknown>> }) => {
    journalMeals = next.meals.map((m) => ({ ...m }))
  }),
}))

import {
  __testReadNutritionQueue,
  __testReadRejectedQueue,
  __testWriteNutritionQueue,
  flushConvexNutritionQueue,
} from './convexNutritionQueue'
import { saveJournalForDate } from './nutritionStorage'

const USER = 'user-b3-q'
const REJECTED_KEY = `ranked-gym:convex-nutrition-rejected:u:${USER}`

describe('convexNutritionQueue — B3-06 syncRejected + plafond 50', () => {
  beforeEach(() => {
    localStorage.clear()
    pushConvexMeal.mockReset()
    pushConvexWaterEntry.mockReset()
    deleteConvexMeal.mockReset()
    deleteConvexWaterEntry.mockReset()
    pushConvexDayState.mockReset()
    vi.mocked(saveJournalForDate).mockClear()
    getActiveCloudUserId.mockReturnValue(USER)
    journalMeals = [
      {
        id: 'meal-ok',
        name: 'Yaourt',
        mealType: 'lunch',
        calories: 81,
        createdAt: 1,
        syncRejected: true,
        syncRejectCode: 'FOOD_ADD_ACCESS_DENIED_MINOR',
        syncRejectedAt: 99,
      },
    ]
  })

  it('envoi réussi meal-upsert efface syncRejected', async () => {
    pushConvexMeal.mockResolvedValueOnce({ applied: true })
    __testWriteNutritionQueue(USER, [
      {
        id: 'op-ok',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-ok',
          name: 'Yaourt',
          mealType: 'lunch',
          calories: 81,
          grams: 150,
          createdAt: 1,
        },
        updatedAt: 2,
        enqueuedAt: 2,
      },
    ])

    await flushConvexNutritionQueue()

    expect(__testReadNutritionQueue(USER)).toHaveLength(0)
    expect(journalMeals).toHaveLength(1)
    expect(journalMeals[0]!.syncRejected).toBeUndefined()
    expect(journalMeals[0]!.syncRejectCode).toBeUndefined()
    expect(journalMeals[0]!.syncRejectedAt).toBeUndefined()
    expect(journalMeals[0]!.id).toBe('meal-ok')
  })

  it('liste refusés plafonnée à 50 (garde les 50 derniers)', async () => {
    const seed = Array.from({ length: 49 }, (_, i) => ({
      opId: `old-${i}`,
      kind: 'meal-upsert' as const,
      code: 'FOOD_ADD_QUANTITY_INVALID',
      rejectedAt: i,
      dateKey: '2026-10-15',
      mealId: `m-${i}`,
    }))
    localStorage.setItem(REJECTED_KEY, JSON.stringify(seed))

    pushConvexMeal
      .mockRejectedValueOnce(
        new ConvexError({ code: 'FOOD_ADD_QUANTITY_INVALID', reason: 'above_max', unit: 'g' }),
      )
      .mockRejectedValueOnce(
        new ConvexError({ code: 'FOOD_ADD_QUANTITY_INVALID', reason: 'above_max', unit: 'g' }),
      )

    __testWriteNutritionQueue(USER, [
      {
        id: 'op-new-1',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-new-1',
          name: 'A',
          mealType: 'lunch',
          calories: 1,
          grams: 2500,
          createdAt: 1,
        },
        updatedAt: 1,
        enqueuedAt: 1,
      },
      {
        id: 'op-new-2',
        kind: 'meal-upsert',
        dateKey: '2026-10-15',
        meal: {
          id: 'meal-new-2',
          name: 'B',
          mealType: 'lunch',
          calories: 1,
          grams: 2500,
          createdAt: 1,
        },
        updatedAt: 2,
        enqueuedAt: 2,
      },
    ])

    await flushConvexNutritionQueue()

    const rejected = __testReadRejectedQueue(USER)
    expect(rejected).toHaveLength(50)
    expect(rejected[0]!.opId).toBe('old-1')
    expect(rejected[48]!.opId).toBe('op-new-1')
    expect(rejected[49]!.opId).toBe('op-new-2')
    expect(rejected.some((r) => r.opId === 'old-0')).toBe(false)
  })
})
