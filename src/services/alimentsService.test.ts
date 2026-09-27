import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenFoodFactsProduct } from './alimentsService'

const isConvexDomainActive = vi.fn()
const fetchOpenFoodFactsViaConvex = vi.fn()
const searchOpenFoodFactsViaConvex = vi.fn()
const listConvexFoodCatalog = vi.fn()
const upsertConvexFoodSelection = vi.fn()
const setConvexFoodFavorite = vi.fn()
const isSupabaseConfigured = vi.fn()
const getSupabase = vi.fn()
const safeWarn = vi.fn()

vi.mock('../backend/adapter', () => ({
  isConvexDomainActive,
}))

vi.mock('./convexNutritionService', () => ({
  fetchOpenFoodFactsViaConvex,
  searchOpenFoodFactsViaConvex,
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

  it('keeps missing nutrients as null (never coerced to 0)', async () => {
    isConvexDomainActive.mockReturnValue(false)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            code: '456',
            product_name: 'Produit Incomplet',
            nutriments: {
              proteins_100g: 10,
            },
          },
        }),
      }),
    )

    const { fetchOpenFoodFacts } = await import('./alimentsService')
    const product = await fetchOpenFoodFacts('456')

    expect(product.calories).toBeNull()
    expect(product.glucides).toBeNull()
    expect(product.lipides).toBeNull()
    expect(product.proteines).toBe(10)
  })

  it('falls back to direct OFF search when Convex action fails', async () => {
    isConvexDomainActive.mockReturnValue(true)
    searchOpenFoodFactsViaConvex.mockRejectedValue(new Error('convex unavailable'))
    listConvexFoodCatalog.mockRejectedValue(new Error('convex unavailable'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          products: [
            {
              code: '111',
              product_name: 'Riz Basmati',
              brands: 'Brand R',
              nutriments: {
                'energy-kcal_100g': 350,
                proteins_100g: 7,
                carbohydrates_100g: 77,
                fat_100g: 1.2,
              },
            },
          ],
        }),
      }),
    )

    const { searchOpenFoodFacts } = await import('./alimentsService')
    const hits = await searchOpenFoodFacts('riz')

    expect(hits).toHaveLength(1)
    expect(hits[0]?.nom).toBe('Riz Basmati')
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
