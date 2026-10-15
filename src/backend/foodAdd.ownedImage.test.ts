import { describe, expect, it } from 'vitest'
import { __test } from '../../convex/foodAdd'

describe('addFoodSnapshot — image refs owned only', () => {
  it('refuse une imageUrl Open Food Facts', () => {
    expect(() =>
      __test.assertOwnedImageArgs({
        imageUrl: 'https://images.openfoodfacts.org/images/products/x.jpg',
        imageStorageId: 'kg2abc' as never,
      }),
    ).toThrow('FOOD_ADD_IMAGE_NOT_OWNED')
  })

  it('refuse une imageUrl sans storageId Convex', () => {
    expect(() =>
      __test.assertOwnedImageArgs({
        imageUrl: 'https://happy.convex.cloud/api/storage/abc',
      }),
    ).toThrow('FOOD_ADD_IMAGE_NOT_OWNED')
  })

  it('accepte storageId Convex (avec URL non-OFF)', () => {
    expect(() =>
      __test.assertOwnedImageArgs({
        imageUrl: 'https://happy.convex.cloud/api/storage/abc',
        imageStorageId: 'kg2abc' as never,
      }),
    ).not.toThrow()
  })

  it('accepte l’absence d’image', () => {
    expect(() => __test.assertOwnedImageArgs({})).not.toThrow()
  })
})
