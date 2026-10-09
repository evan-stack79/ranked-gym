/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => false,
}))

vi.mock('./convexNutritionQueue', () => ({
  enqueueConvexNutritionOp: vi.fn(),
}))

describe('nutritionStorage meal updatedAt (architect)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('chaque repas ajouté a son propre updatedAt ; update bump updatedAt', async () => {
    const { addMealToToday, updateMealInToday, getTodayJournal } = await import(
      './nutritionStorage'
    )

    const first = addMealToToday({
      name: 'A',
      mealType: 'lunch',
      calories: 100,
      portionLabel: 'pour 100 g',
      updatedAt: 111,
      createdAt: 111,
    })
    expect(first.meals[0]?.updatedAt).toBe(111)

    const second = addMealToToday({
      name: 'B',
      mealType: 'lunch',
      calories: 200,
      portionLabel: '30 g',
      updatedAt: 222,
      createdAt: 222,
    })
    expect(second.meals[0]?.updatedAt).toBe(222)
    expect(second.meals[1]?.updatedAt).toBe(111)

    const mealId = second.meals[0]!.id
    const before = Date.now()
    updateMealInToday(mealId, { name: 'B2' })
    const after = getTodayJournal().meals.find((m) => m.id === mealId)
    expect(after?.updatedAt).toBeGreaterThanOrEqual(before)
    expect(after?.name).toBe('B2')
  })
})
