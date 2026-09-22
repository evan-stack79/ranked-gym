import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchConvexJournalSnapshot = vi.fn()
const enqueueConvexNutritionOp = vi.fn()
const flushConvexNutritionQueue = vi.fn()
const getMealJournal = vi.fn()
const saveMealJournal = vi.fn()
const safeWarn = vi.fn()

vi.mock('./convexNutritionService', () => ({
  fetchConvexJournalSnapshot,
}))

vi.mock('./convexNutritionQueue', () => ({
  enqueueConvexNutritionOp,
  flushConvexNutritionQueue,
}))

vi.mock('./nutritionStorage', () => ({
  getMealJournal,
  saveMealJournal,
}))

vi.mock('../utils/safeLog', () => ({
  safeWarn,
}))

describe('hydrateConvexNutritionJournal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    flushConvexNutritionQueue.mockResolvedValue(undefined)
    getMealJournal.mockReturnValue({})
  })

  it('hydrates granular meals/water/day-state into local journal', async () => {
    fetchConvexJournalSnapshot.mockResolvedValue({
      meals: [
        {
          mealId: 'meal-a',
          dateKey: '2026-09-22',
          mealType: 'lunch',
          name: 'Poulet',
          calories: 610,
          proteinG: 48,
          carbsG: 50,
          fatG: 20,
          createdAt: 100,
          updatedAt: 200,
        },
      ],
      waterEntries: [
        {
          entryId: 'w-1',
          dateKey: '2026-09-22',
          amountMl: 250,
          type: 'glass',
          label: 'Verre',
          createdAt: 110,
          updatedAt: 210,
        },
      ],
      dayStates: [
        {
          dateKey: '2026-09-22',
          waterBottleLevelMl: 900,
          waterBottleCalibrationTotalMl: 600,
          updatedAt: 220,
        },
      ],
    })

    const { hydrateConvexNutritionJournal } = await import('./convexNutritionHydration')
    const result = await hydrateConvexNutritionJournal()

    expect(result.applied).toBe(true)
    expect(result.datesTouched).toBe(1)
    expect(saveMealJournal).toHaveBeenCalledTimes(1)
    const saved = saveMealJournal.mock.calls[0]?.[0]
    expect(saved['2026-09-22'].meals).toHaveLength(1)
    expect(saved['2026-09-22'].waterEntries).toHaveLength(1)
    expect(saved['2026-09-22'].waterMl).toBe(250)
    expect(saved['2026-09-22'].waterBottleLevelMl).toBe(900)
  })

  it('seeds remote queue from local data when remote snapshot is empty', async () => {
    fetchConvexJournalSnapshot.mockResolvedValue({
      meals: [],
      waterEntries: [],
      dayStates: [],
    })
    getMealJournal.mockReturnValue({
      '2026-09-20': {
        dateKey: '2026-09-20',
        meals: [
          {
            id: 'meal-local',
            mealType: 'dinner',
            name: 'Skyr',
            calories: 200,
            createdAt: 10,
          },
        ],
        waterEntries: [
          {
            id: 'w-local',
            amountMl: 300,
            createdAt: 20,
            type: 'manual',
            label: 'Ajustement',
          },
        ],
        waterBottleLevelMl: 400,
      },
    })

    const { hydrateConvexNutritionJournal } = await import('./convexNutritionHydration')
    const result = await hydrateConvexNutritionJournal()

    expect(result.applied).toBe(false)
    expect(enqueueConvexNutritionOp).toHaveBeenCalled()
    expect(flushConvexNutritionQueue).toHaveBeenCalled()
  })

  it('removes deleted remote meals and entries during hydration', async () => {
    getMealJournal.mockReturnValue({
      '2026-09-22': {
        dateKey: '2026-09-22',
        meals: [
          {
            id: 'meal-delete',
            mealType: 'snack',
            name: 'Old',
            calories: 100,
            createdAt: 5,
          },
        ],
        waterEntries: [
          {
            id: 'w-delete',
            amountMl: 120,
            createdAt: 6,
            type: 'legacy',
            label: 'Eau',
          },
        ],
      },
    })

    fetchConvexJournalSnapshot.mockResolvedValue({
      meals: [
        {
          mealId: 'meal-delete',
          dateKey: '2026-09-22',
          mealType: 'snack',
          name: 'Old',
          calories: 100,
          createdAt: 5,
          updatedAt: 100,
          deletedAt: 100,
        },
      ],
      waterEntries: [
        {
          entryId: 'w-delete',
          dateKey: '2026-09-22',
          amountMl: 120,
          type: 'legacy',
          label: 'Eau',
          createdAt: 6,
          updatedAt: 101,
          deletedAt: 101,
        },
      ],
      dayStates: [],
    })

    const { hydrateConvexNutritionJournal } = await import('./convexNutritionHydration')
    await hydrateConvexNutritionJournal()

    const saved = saveMealJournal.mock.calls[0]?.[0]
    expect(saved['2026-09-22'].meals).toHaveLength(0)
    expect(saved['2026-09-22'].waterEntries).toBeUndefined()
  })
})
