import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/foodAddV3FeatureFlag', () => ({
  isFoodAddV3Enabled: () => true,
}))

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => true,
}))

const searchFoodsV3ViaConvex = vi.fn()

vi.mock('./convexNutritionService', () => ({
  searchFoodsV3ViaConvex: (...args: unknown[]) => searchFoodsV3ViaConvex(...args),
  searchOpenFoodFactsViaConvex: vi.fn(),
  fetchOpenFoodFactsViaConvex: vi.fn(),
  listConvexFoodCatalog: vi.fn(),
  setConvexFoodFavorite: vi.fn(),
  upsertConvexFoodSelection: vi.fn(),
}))

describe('alimentsService v3 — jamais de contact OFF depuis le téléphone', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('passe par Convex et n’appelle pas world.openfoodfacts.org', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    searchFoodsV3ViaConvex.mockResolvedValue({
      hits: [
        {
          barcode: '1',
          nom: 'Skyr',
          brands: 'Danone',
          servingSize: '140 g',
          portionLabel: '140 g',
          categoriesTags: ['en:dairies'],
          imageUrl: 'https://x.convex.cloud/img',
          provenance: 'open_food_facts',
          fetchedAt: 1,
        },
      ],
      searchCount: 1,
      dailyLimit: 40,
    })

    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('skyr', undefined, { categoryTag: 'en:dairies' })

    expect(hits).toHaveLength(1)
    expect(hits[0]!.nom).toBe('Skyr')
    expect(searchFoodsV3ViaConvex).toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
