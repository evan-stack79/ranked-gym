/**
 * A2 — resolveAddFoodSnapshotQuantity (logique mutation addFoodSnapshot).
 * grams/pieces toujours validés s’ils sont présents ; sinon below_min.
 * Mode grams : portionLabel serveur uniquement.
 */
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import { __test } from '../../convex/foodAdd'
import { FOOD_ADD_QUANTITY_INVALID } from '../../convex/lib/foodAddQuantity'

function expectQtyConvexError(
  fn: () => unknown,
  reason: string,
  unit?: 'g' | 'pieces',
) {
  try {
    fn()
    expect.fail('expected ConvexError')
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError)
    const data = (error as ConvexError<{ code: string; reason?: string; unit?: string }>).data
    expect(data.code).toBe(FOOD_ADD_QUANTITY_INVALID)
    expect(data.reason).toBe(reason)
    if (unit) expect(data.unit).toBe(unit)
  }
}

describe('addFoodSnapshot — resolveAddFoodSnapshotQuantity (A2)', () => {
  it('grams:-5 rejeté (below_min)', () => {
    expectQtyConvexError(
      () => __test.resolveAddFoodSnapshotQuantity({ grams: -5 }),
      'below_min',
      'g',
    )
  })

  it('grams:0 rejeté (below_min)', () => {
    expectQtyConvexError(
      () => __test.resolveAddFoodSnapshotQuantity({ grams: 0 }),
      'below_min',
      'g',
    )
  })

  it('pieces:0 rejeté (below_min)', () => {
    expectQtyConvexError(
      () => __test.resolveAddFoodSnapshotQuantity({ pieces: 0 }),
      'below_min',
      'pieces',
    )
  })

  it('ni grams ni pieces → below_min', () => {
    expectQtyConvexError(() => __test.resolveAddFoodSnapshotQuantity({}), 'below_min')
  })

  it('portionLabel client « -5 g » + grams:30 → stocke « 30 g » (serveur)', () => {
    // args.portionLabel n’entre pas dans resolve — le serveur écrit depuis grams validés.
    const clientPortionLabel = '-5 g'
    void clientPortionLabel
    const resolved = __test.resolveAddFoodSnapshotQuantity({ grams: 30 })
    expect(resolved.portionLabel).toBe('30 g')
    expect(resolved.storeGrams).toBe(30)
    expect(resolved.storePieces).toBeUndefined()
    expect(resolved.portionLabel).not.toBe('-5 g')
  })

  it('grams:NaN rejeté (invalid)', () => {
    expectQtyConvexError(
      () => __test.resolveAddFoodSnapshotQuantity({ grams: Number.NaN }),
      'invalid',
      'g',
    )
  })

  it('pièces validées : portionLabel serveur', () => {
    const resolved = __test.resolveAddFoodSnapshotQuantity({ pieces: 2, servingGrams: 15 })
    expect(resolved.storePieces).toBe(2)
    expect(resolved.storeGrams).toBe(30)
    expect(resolved.portionLabel).toBe('2 pièces')
  })
})
