import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenFoodFactsProduct } from './alimentsService'

const isConvexDomainActive = vi.fn()
const fetchOpenFoodFactsViaConvex = vi.fn()
const searchOpenFoodFactsViaConvex = vi.fn()
const searchFoodsV3ViaConvex = vi.fn()
const listConvexFoodCatalog = vi.fn()
const upsertConvexFoodSelection = vi.fn()
const setConvexFoodFavorite = vi.fn()
const isSupabaseConfigured = vi.fn()
const getSupabase = vi.fn()
const safeWarn = vi.fn()
const isFoodAddV3Enabled = vi.fn(() => false)

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive,
}))

vi.mock('../backend/foodAddV3FeatureFlag', () => ({
  isFoodAddV3Enabled,
}))

vi.mock('./convexNutritionService', () => ({
  fetchOpenFoodFactsViaConvex,
  searchOpenFoodFactsViaConvex,
  searchFoodsV3ViaConvex,
  listConvexFoodCatalog,
  upsertConvexFoodSelection,
  setConvexFoodFavorite,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured,
  getSupabase,
}))

vi.mock('../utils/safeLog', () => ({
  safeWarn,
}))

describe('alimentsService Convex primary migration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(false)
  })

  it('merges personal recent foods with OFF search hits in Convex mode', async () => {
    isConvexDomainActive.mockReturnValue(true)
    searchOpenFoodFactsViaConvex.mockResolvedValue([
      {
        barcode: '123',
        nom: 'Poulet Grille',
        brands: 'Brand A',
        calories: 180,
        proteines: 25,
        glucides: 0,
        lipides: 7,
        provenance: 'open_food_facts',
        fetchedAt: 1,
      },
    ])
    listConvexFoodCatalog.mockResolvedValue([
      {
        foodKey: 'barcode:999',
        barcode: '999',
        name: 'Poulet Maison',
        brand: 'Meal Prep',
        caloriesPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        source: 'open_food_facts',
        imageUrl: undefined,
        lastFetchedAt: 2,
        lastSelectedAt: 100,
        selectedCount: 4,
        isFavorite: true,
        updatedAt: 3,
      },
    ])

    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('poulet')

    expect(hits.length).toBe(2)
    expect(hits[0]?.nom).toBe('Poulet Maison')
    expect(hits[0]?.brands).toBe('Meal Prep')
    expect(hits[0]?.foodKey).toBe('barcode:999')
    expect(hits[0]?.isFavorite).toBe(true)
    expect(hits[1]?.nom).toBe('Poulet Grille')
  })

  it('keeps missing nutrients as null (never coerced to 0) via Convex', async () => {
    isConvexDomainActive.mockReturnValue(true)
    fetchOpenFoodFactsViaConvex.mockResolvedValue({
      barcode: '456',
      nom: 'Produit Incomplet',
      brands: '',
      calories: null,
      proteines: 10,
      glucides: null,
      lipides: null,
      provenance: 'open_food_facts',
      fetchedAt: 1,
    })

    const { fetchOpenFoodFacts } = await import('./alimentsService')
    const product = await fetchOpenFoodFacts('456')

    expect(product.calories).toBeNull()
    expect(product.glucides).toBeNull()
    expect(product.lipides).toBeNull()
    expect(product.proteines).toBe(10)
  })

  it('never calls world.openfoodfacts.org when Convex search fails (online → message, pas 0)', async () => {
    isConvexDomainActive.mockReturnValue(true)
    searchOpenFoodFactsViaConvex.mockRejectedValue(new Error('convex unavailable'))
    listConvexFoodCatalog.mockRejectedValue(new Error('convex unavailable'))

    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', { onLine: true })

    const { searchOpenFoodFacts, FOOD_SEARCH_NETWORK_ERROR_MSG } = await import('./alimentsService')
    await expect(searchOpenFoodFacts('riz')).rejects.toThrow(FOOD_SEARCH_NETWORK_ERROR_MSG)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(safeWarn).toHaveBeenCalled()
  })

  it('uses Convex food selection upsert when Convex is active', async () => {
    isConvexDomainActive.mockReturnValue(true)
    upsertConvexFoodSelection.mockResolvedValue({ applied: true, foodKey: 'barcode:111', selectedCount: 1 })

    const { saveAliment } = await import('./alimentsService')
    const result = await saveAliment(
      {
        barcode: '111',
        nom: 'Riz',
        calories: 360,
        proteines: 7,
        glucides: 78,
        lipides: 1,
        provenance: 'open_food_facts',
        fetchedAt: Date.now(),
      },
      'user-1',
    )

    expect(result).toBeNull()
    expect(upsertConvexFoodSelection).toHaveBeenCalledTimes(1)
  })

  it('does not fallback to Supabase when Convex save fails in convex-primary mode', async () => {
    isConvexDomainActive.mockReturnValue(true)
    isSupabaseConfigured.mockReturnValue(true)
    upsertConvexFoodSelection.mockRejectedValue(new Error('convex outage'))

    const { saveAliment } = await import('./alimentsService')
    await expect(
      saveAliment(
        {
          barcode: '333',
          nom: 'Quinoa',
          calories: 350,
          proteines: 12,
          glucides: 64,
          lipides: 6,
          provenance: 'open_food_facts',
          fetchedAt: Date.now(),
        },
        'user-4',
      ),
    ).rejects.toThrow('Impossible d’enregistrer cet aliment sur Convex')
    expect(getSupabase).not.toHaveBeenCalled()
  })

  it('keeps nullable nutrients when saving Convex selections', async () => {
    isConvexDomainActive.mockReturnValue(true)
    upsertConvexFoodSelection.mockResolvedValue({ applied: true, foodKey: 'barcode:222', selectedCount: 1 })

    const { saveAliment } = await import('./alimentsService')
    await saveAliment(
      {
        barcode: '222',
        nom: 'Produit ND',
        calories: null,
        proteines: null,
        glucides: 12,
        lipides: null,
        provenance: 'open_food_facts',
        fetchedAt: Date.now(),
      },
      'user-3',
    )

    expect(upsertConvexFoodSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        caloriesPer100g: null,
        proteinPer100g: null,
        carbsPer100g: 12,
        fatPer100g: null,
      }),
    )
  })

  it('skips Supabase fallback write when nutrients are missing', async () => {
    isConvexDomainActive.mockReturnValue(false)
    isSupabaseConfigured.mockReturnValue(true)

    const { saveAliment } = await import('./alimentsService')
    const product: OpenFoodFactsProduct = {
      barcode: '777',
      nom: 'Produit Sans Kcal',
      calories: null,
      proteines: 10,
      glucides: null,
      lipides: 3,
      provenance: 'open_food_facts',
      fetchedAt: Date.now(),
    }

    const result = await saveAliment(product, 'user-2')
    expect(result).toBeNull()
    expect(getSupabase).not.toHaveBeenCalled()
    expect(safeWarn).toHaveBeenCalled()
  })

  it('maps Convex personal food catalog rows for recent/favorites listing', async () => {
    isConvexDomainActive.mockReturnValue(true)
    listConvexFoodCatalog.mockResolvedValue([
      {
        foodKey: 'barcode:321',
        barcode: '321',
        name: 'Skyr Nature',
        brand: 'Yaourt+',
        caloriesPer100g: 62,
        proteinPer100g: 11,
        carbsPer100g: 4,
        fatPer100g: 0.2,
        imageUrl: undefined,
        source: 'open_food_facts',
        lastFetchedAt: 10,
        lastSelectedAt: 12,
        selectedCount: 9,
        isFavorite: true,
        updatedAt: 15,
      },
    ])

    const { listPersonalFoods } = await import('./alimentsService')
    const rows = await listPersonalFoods({ favoritesOnly: true })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.nom).toBe('Skyr Nature')
    expect(rows[0]?.isFavorite).toBe(true)
    expect(rows[0]?.selectedCount).toBe(9)
  })

  it('updates favorite flag through Convex when domain is active', async () => {
    isConvexDomainActive.mockReturnValue(true)
    setConvexFoodFavorite.mockResolvedValue({ applied: true })

    const { setPersonalFoodFavorite } = await import('./alimentsService')
    const ok = await setPersonalFoodFavorite('barcode:321', true)

    expect(ok).toBe(true)
    expect(setConvexFoodFavorite).toHaveBeenCalledWith('barcode:321', true)
  })
})
