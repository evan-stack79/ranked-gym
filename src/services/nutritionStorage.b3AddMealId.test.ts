/** @vitest-environment jsdom */
/**
 * B3-05 — addMealToDate met à jour la ligne au même mealId (pas de 2e ligne).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => false,
}))

vi.mock('./convexNutritionQueue', () => ({
  enqueueConvexNutritionOp: vi.fn(),
}))

describe('nutritionStorage — B3-05 addMealToDate même mealId', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('2 addMealToDate même id → 1 ligne mise à jour', async () => {
    const { addMealToDate, getJournalForDate } = await import('./nutritionStorage')
    const dateKey = '2026-10-15'
    addMealToDate(dateKey, {
      id: 'meal-dup',
      name: 'Yaourt',
      mealType: 'lunch',
      calories: 81,
      grams: 150,
      createdAt: 1,
      updatedAt: 1,
    })
    addMealToDate(dateKey, {
      id: 'meal-dup',
      name: 'Yaourt',
      mealType: 'lunch',
      calories: 81,
      grams: 200,
      createdAt: 1,
      updatedAt: 2,
    })
    const journal = getJournalForDate(dateKey)
    expect(journal.meals).toHaveLength(1)
    expect(journal.meals[0]!.id).toBe('meal-dup')
    expect(journal.meals[0]!.grams).toBe(200)
    expect(journal.meals[0]!.updatedAt).toBe(2)
  })
})
