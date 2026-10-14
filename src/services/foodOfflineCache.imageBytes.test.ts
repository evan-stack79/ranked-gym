/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearFoodOfflineCache,
  listCachedFoods,
  rememberFoodHits,
  resolveCachedImageUrl,
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

describe('foodOfflineCache — octets image (pas seulement l’URL)', () => {
  beforeEach(() => {
    clearFoodOfflineCache()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearFoodOfflineCache()
  })

  it('met en cache les octets image (data URL) depuis notre stockage', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => pngHeader.buffer,
      }),
    )

    rememberFoodHits([HIT])
    // Attendre le fetch async des octets.
    await vi.waitFor(() => {
      const cached = listCachedFoods({ term: 'banane' })
      expect(cached[0]?.imageUrl?.startsWith('data:image/png;base64,')).toBe(true)
    })

    const resolved = resolveCachedImageUrl(HIT)
    expect(resolved?.startsWith('data:image/png;base64,')).toBe(true)
    expect(resolved).not.toContain('openfoodfacts.org')
  })

  it('refuse de fetcher une URL Open Food Facts', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    rememberFoodHits([
      {
        ...HIT,
        imageUrl: 'https://images.openfoodfacts.org/images/products/x.jpg',
      },
    ])
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
