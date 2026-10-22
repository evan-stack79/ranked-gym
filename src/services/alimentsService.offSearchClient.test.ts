/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenFoodFactsSearchHit } from './alimentsService'

vi.mock('../backend/foodAddV3FeatureFlag', () => ({
  isFoodAddV3Enabled: () => true,
}))

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive: () => true,
}))

const searchFoodsV3ViaConvex = vi.fn()
const rememberFoodHitsSpy = vi.fn()
const listCachedFoodsSpy = vi.fn<(...args: unknown[]) => OpenFoodFactsSearchHit[]>(() => [])

vi.mock('./convexNutritionService', () => ({
  searchFoodsV3ViaConvex: (...args: unknown[]) => searchFoodsV3ViaConvex(...args),
  searchOpenFoodFactsViaConvex: vi.fn(),
  fetchOpenFoodFactsViaConvex: vi.fn(),
  listConvexFoodCatalog: vi.fn(),
  setConvexFoodFavorite: vi.fn(),
  upsertConvexFoodSelection: vi.fn(),
}))

vi.mock('./foodOfflineCache', () => ({
  rememberFoodHits: (...args: unknown[]) => rememberFoodHitsSpy(...args),
  listCachedFoods: (...args: unknown[]) => listCachedFoodsSpy(...args),
}))

describe('alimentsService V3 — recherche OFF simulée (croissant/pain/yaourt/pomme)', () => {
  beforeEach(() => {
    vi.resetModules()
    searchFoodsV3ViaConvex.mockReset()
    rememberFoodHitsSpy.mockReset()
    listCachedFoodsSpy.mockReset()
    listCachedFoodsSpy.mockReturnValue([])
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function hit(nom: string, barcode: string): OpenFoodFactsSearchHit {
    return {
      barcode,
      nom,
      brands: '',
      calories: null,
      proteines: null,
      glucides: null,
      lipides: null,
      servingSize: null,
      categoriesTags: [],
      provenance: 'open_food_facts',
      fetchedAt: 1,
    }
  }

  const cases: Array<{ term: string; names: string[] }> = [
    {
      term: 'croissant',
      names: ['Croissant', 'Croissant beurre', 'Croissants x4', 'Mini croissant au chocolat'],
    },
    { term: 'pain', names: ['Pain', 'Pain de mie complet', 'Pain aux céréales'] },
    { term: 'yaourt', names: ['Yaourt', 'Yaourt nature', 'Yaourt à la grecque'] },
    { term: 'pomme', names: ['Pomme', 'Pommes golden', 'Jus de pomme'] },
  ]

  for (const { term, names } of cases) {
    it(`${term} : renvoie les hits Convex triés (pas d’appel OFF téléphone)`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      searchFoodsV3ViaConvex.mockResolvedValue({
        hits: names.map((nom, i) => ({
          barcode: `${term}-${i}`,
          nom,
          brands: '',
          servingSize: null,
          portionLabel: '',
          categoriesTags: [],
          provenance: 'open_food_facts' as const,
          fetchedAt: 1,
        })),
        searchCount: 1,
        dailyLimit: 40,
      })
      const { searchOpenFoodFacts } = await import('./alimentsService')
      const hits = await searchOpenFoodFacts(term)
      expect(hits.map((h) => h.nom)).toEqual(names)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(rememberFoodHitsSpy).toHaveBeenCalled()
    })
  }

  it('erreur réseau en ligne : message clair, pas cache vide, pas remember', async () => {
    searchFoodsV3ViaConvex.mockRejectedValue(new Error('FOOD_SEARCH_NETWORK:OFF_HTTP_503'))
    const { searchOpenFoodFacts, FOOD_SEARCH_NETWORK_ERROR_MSG } = await import('./alimentsService')
    await expect(searchOpenFoodFacts('croissant')).rejects.toThrow(FOOD_SEARCH_NETWORK_ERROR_MSG)
    expect(rememberFoodHitsSpy).not.toHaveBeenCalled()
    expect(listCachedFoodsSpy).not.toHaveBeenCalled()
  })

  it('hors ligne : repli cache (pas de faux « succès vide » inventé)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    listCachedFoodsSpy.mockReturnValue([hit('Croissant cache', 'c-off')])
    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('croissant')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.nom).toBe('Croissant cache')
    expect(searchFoodsV3ViaConvex).not.toHaveBeenCalled()
  })
})
