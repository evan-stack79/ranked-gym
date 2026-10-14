import { describe, expect, it } from 'vitest'
import { __test } from './foodAdd'

describe('foodAdd — mapping OFF + quota', () => {
  it('mappe serving_size et categories_tags (sans hotlink image)', () => {
    const mapped = __test.mapOffProduct(
      {
        code: '20753030',
        product_name_fr: 'bananes Cavendish',
        brands: 'Oaklands',
        serving_size: '1 serving (100 g)',
        categories_tags: ['en:fruits'],
        image_front_url: 'https://images.openfoodfacts.org/x.jpg',
        nutriments: { 'energy-kcal_100g': 89, proteins_100g: 1 },
      },
      '20753030',
    )
    expect(mapped.servingSize).toBe('1 serving (100 g)')
    expect(mapped.categoriesTags).toContain('en:fruits')
    expect(mapped.offImageUrl).toContain('openfoodfacts.org')
    // L’URL OFF reste interne au serveur pour mirroring — jamais renvoyée telle quelle au client.
    expect(mapped.barcode).toBe('20753030')
  })

  it('expose une limite journalière > 0', () => {
    expect(__test.FOOD_SEARCH_DAILY_LIMIT).toBeGreaterThan(0)
  })
})
