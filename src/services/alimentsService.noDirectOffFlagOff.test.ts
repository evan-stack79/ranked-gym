import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../backend/foodAddV3FeatureFlag', () => ({
  isFoodAddV3Enabled: () => false,
}))

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => true,
}))

const searchOpenFoodFactsViaConvex = vi.fn()
const searchFoodsV3ViaConvex = vi.fn()
const listConvexFoodCatalog = vi.fn()
const fetchOpenFoodFactsViaConvex = vi.fn()

vi.mock('./convexNutritionService', () => ({
  searchOpenFoodFactsViaConvex: (...args: unknown[]) => searchOpenFoodFactsViaConvex(...args),
  searchFoodsV3ViaConvex: (...args: unknown[]) => searchFoodsV3ViaConvex(...args),
  fetchOpenFoodFactsViaConvex: (...args: unknown[]) => fetchOpenFoodFactsViaConvex(...args),
  listConvexFoodCatalog: (...args: unknown[]) => listConvexFoodCatalog(...args),
  setConvexFoodFavorite: vi.fn(),
  upsertConvexFoodSelection: vi.fn(),
}))

describe('alimentsService — flag OFF : jamais de contact OFF direct', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('recherche texte legacy via Convex uniquement (pas enrichServingFromDirect)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    searchOpenFoodFactsViaConvex.mockResolvedValue([
      {
        barcode: '1',
        nom: 'Riz',
        brands: '',
        calories: 350,
        proteines: 7,
        glucides: 77,
        lipides: 1,
        servingSize: '60 g',
        categoriesTags: [],
        imageUrl: 'https://x.convex.cloud/riz',
        provenance: 'open_food_facts',
        fetchedAt: 1,
      },
    ])
    listConvexFoodCatalog.mockResolvedValue([])

    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('riz')

    expect(hits).toHaveLength(1)
    expect(searchOpenFoodFactsViaConvex).toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('recherche catégorie legacy via searchOpenFoodFacts (pas de quota v3)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    searchOpenFoodFactsViaConvex.mockResolvedValue([
      {
        barcode: '2',
        nom: 'Pomme',
        brands: '',
        calories: 52,
        proteines: 0,
        glucides: 14,
        lipides: 0,
        servingSize: '150 g',
        categoriesTags: ['en:fruits'],
        imageUrl: 'https://x.convex.cloud/pomme',
        provenance: 'open_food_facts',
        fetchedAt: 1,
      },
    ])
    listConvexFoodCatalog.mockResolvedValue([])

    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('', undefined, { categoryTag: 'en:fruits' })

    expect(hits).toHaveLength(1)
    expect(searchOpenFoodFactsViaConvex).toHaveBeenCalledWith('', 20, { categoryTag: 'en:fruits' })
    expect(searchFoodsV3ViaConvex).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('barcode : échec Convex → erreur, pas de repli OFF direct', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    fetchOpenFoodFactsViaConvex.mockRejectedValue(new Error('OFF_PRODUCT_NOT_FOUND'))

    const { fetchOpenFoodFacts } = await import('./alimentsService')
    await expect(fetchOpenFoodFacts('123')).rejects.toThrow(/Produit introuvable|Réessaie/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
