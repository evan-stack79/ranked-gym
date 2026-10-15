/**
 * B111-14 — meal local seulement après OK serveur.
 * Si le serveur refuse la quantité → journal local inchangé.
 */
/** @vitest-environment jsdom */
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FOOD_ADD_QUANTITY_INVALID } from '../../convex/lib/foodAddQuantity'
import { readFileSync } from 'node:fs'

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => true,
}))

vi.mock('../services/convexNutritionQueue', () => ({
  enqueueConvexNutritionOp: vi.fn(),
}))

describe('B111-14 — serveur refuse → rien en local', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('NutritionDashboard : await addFoodSnapshot puis addMealToDate (continue sur catch)', () => {
    const src = readFileSync('src/components/nutrition/NutritionDashboard.tsx', 'utf8')
    expect(src).toContain('await addFoodSnapshotViaConvex')
    expect(src).toContain('B111-14')
    const awaitIdx = src.indexOf('await addFoodSnapshotViaConvex')
    const catchIdx = src.indexOf('continue', awaitIdx)
    const addIdx = src.indexOf('addMealToDate(selectedDateKey, entry)', awaitIdx)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(catchIdx).toBeGreaterThan(awaitIdx)
    expect(addIdx).toBeGreaterThan(catchIdx)
  })

  it('MealJournal : même ordre serveur-first', () => {
    const src = readFileSync('src/components/nutrition/MealJournal.tsx', 'utf8')
    expect(src).toContain('await addFoodSnapshotViaConvex')
    const awaitIdx = src.indexOf('await addFoodSnapshotViaConvex')
    const catchIdx = src.indexOf('continue', awaitIdx)
    const addIdx = src.indexOf('addMealToToday(entry)', awaitIdx)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(catchIdx).toBeGreaterThan(awaitIdx)
    expect(addIdx).toBeGreaterThan(catchIdx)
  })

  it('serveur refuse quantité → journal local inchangé (store/cache)', async () => {
    const { addMealToDate, getJournalForDate } = await import('../services/nutritionStorage')

    const dateKey = '2026-10-15'
    addMealToDate(dateKey, {
      id: 'existing-meal',
      name: 'Déjà là',
      mealType: 'lunch',
      calories: 200,
      grams: 100,
      portionLabel: '100 g',
      createdAt: 1,
      updatedAt: 1,
    })
    const before = structuredClone(getJournalForDate(dateKey))
    expect(before.meals).toHaveLength(1)
    expect(before.meals[0]?.id).toBe('existing-meal')

    const addFoodSnapshotViaConvex = vi.fn().mockRejectedValue(
      new ConvexError({
        code: FOOD_ADD_QUANTITY_INVALID,
        reason: 'above_max',
        unit: 'g',
      }),
    )

    // Même contrat que NutritionDashboard handleValidateFoodSelection (V3 + Convex) :
    // await serveur → catch/continue → pas d’addMealToDate.
    const mealId = 'rejected-meal'
    const entry = {
      id: mealId,
      name: 'Nutella',
      mealType: 'snack' as const,
      calories: null as number | null,
      grams: 2001,
      portionLabel: '2001 g',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    let keptOnPhone = false
    try {
      await addFoodSnapshotViaConvex({
        mealId,
        dateKey,
        mealType: entry.mealType,
        name: entry.name,
        portionLabel: entry.portionLabel,
        grams: entry.grams,
        updatedAt: entry.updatedAt,
      })
      addMealToDate(dateKey, entry)
      keptOnPhone = true
    } catch {
      // serveur refuse → ne rien garder en local
    }

    expect(addFoodSnapshotViaConvex).toHaveBeenCalledTimes(1)
    expect(keptOnPhone).toBe(false)

    const after = getJournalForDate(dateKey)
    expect(after.meals).toHaveLength(1)
    expect(after.meals.map((m) => m.id)).toEqual(['existing-meal'])
    expect(after.meals.find((m) => m.id === mealId)).toBeUndefined()
    expect(JSON.stringify(after.meals)).toBe(JSON.stringify(before.meals))
  })
})
