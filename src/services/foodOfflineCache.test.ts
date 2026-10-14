/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearFoodOfflineCache,
  listCachedFoods,
  rememberFoodHits,
} from './foodOfflineCache'
import type { OpenFoodFactsSearchHit } from './alimentsService'

const HIT: OpenFoodFactsSearchHit = {
  barcode: '20753030',
  nom: 'Bananes Cavendish',
  brands: 'Oaklands',
  calories: 89,
  proteines: 1,
  glucides: 23,
  lipides: 0,
  imageUrl: 'https://happy.convex.cloud/api/storage/abc',
  imageStorageId: 'storage:abc',
  servingSize: '1 serving (100 g)',
  categoriesTags: ['en:fruits'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

describe('foodOfflineCache', () => {
  beforeEach(() => {
    clearFoodOfflineCache()
  })

  it('garde les aliments récemment vus pour l’offline (URL Ranked Gym, pas OFF)', () => {
    rememberFoodHits([HIT])
    const cached = listCachedFoods({ term: 'banane' })
    expect(cached).toHaveLength(1)
    expect(cached[0]!.nom).toBe('Bananes Cavendish')
    expect(cached[0]!.imageUrl).toContain('convex.cloud')
    expect(cached[0]!.imageUrl).not.toContain('openfoodfacts.org')
  })

  it('filtre par catégorie', () => {
    rememberFoodHits([HIT])
    expect(listCachedFoods({ categoryTag: 'en:fruits' })).toHaveLength(1)
    expect(listCachedFoods({ categoryTag: 'en:beverages' })).toHaveLength(0)
  })
})
