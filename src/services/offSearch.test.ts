import { describe, expect, it, vi } from 'vitest'
import {
  buildOffSearchUrl,
  fetchOffSearchJson,
  OFF_SEARCH_BASE_URL,
  OFF_SEARCH_PAGE_SIZE,
  offProductLabel,
  pickOffSearchProducts,
  rankOffSearchProducts,
  scoreOffSearchProduct,
  type OffSearchProduct,
} from '../../convex/lib/offSearch'

/** Réponses OFF simulées (pas de réseau) — cas « avant » popularité seule vs « après » pertinence. */
const FIXTURES: Record<string, OffSearchProduct[]> = {
  croissant: [
    {
      code: '1',
      product_name: 'Mini croissant au chocolat',
      product_name_fr: 'Mini croissant au chocolat',
      countries_tags: ['en:france'],
      unique_scans_n: 9000,
    },
    {
      code: '2',
      product_name: 'Croissant',
      product_name_fr: 'Croissant',
      countries_tags: ['en:france'],
      unique_scans_n: 400,
    },
    {
      code: '3',
      product_name: 'Croissant beurre',
      product_name_fr: 'Croissant beurre',
      countries_tags: ['en:france'],
      unique_scans_n: 800,
    },
    {
      code: '4',
      product_name: 'Pain au chocolat',
      countries_tags: ['en:belgium'],
      unique_scans_n: 5000,
    },
    {
      code: '5',
      product_name_fr: 'Croissants x4',
      countries_tags: ['en:france'],
      unique_scans_n: 200,
    },
  ],
  pain: [
    {
      code: 'p1',
      product_name_fr: 'Pain de mie complet',
      countries_tags: ['en:france'],
      unique_scans_n: 3000,
    },
    {
      code: 'p2',
      product_name_fr: 'Pain',
      countries_tags: ['en:france'],
      unique_scans_n: 100,
    },
    {
      code: 'p3',
      product_name: 'Whole wheat bread',
      countries_tags: ['en:united-states'],
      unique_scans_n: 8000,
    },
    {
      code: 'p4',
      product_name_fr: 'Pain aux céréales',
      countries_tags: ['en:france'],
      unique_scans_n: 500,
    },
    {
      code: 'p5',
      product_name_fr: 'Baguette de pain',
      countries_tags: ['en:france'],
      unique_scans_n: 2000,
    },
  ],
  yaourt: [
    {
      code: 'y1',
      product_name: 'Le nature',
      countries_tags: ['en:morocco'],
      unique_scans_n: 20000,
    },
    {
      code: 'y2',
      product_name_fr: 'Yaourt nature',
      countries_tags: ['en:france'],
      unique_scans_n: 900,
    },
    {
      code: 'y3',
      product_name_fr: 'Yaourt',
      countries_tags: ['en:france'],
      unique_scans_n: 300,
    },
    {
      code: 'y4',
      product_name_fr: 'Yaourt à la grecque',
      countries_tags: ['en:france'],
      unique_scans_n: 1200,
    },
    {
      code: 'y5',
      product_name: 'Greek yogurt',
      countries_tags: ['en:united-states'],
      unique_scans_n: 15000,
    },
  ],
  pomme: [
    {
      code: 'a1',
      product_name_fr: 'Jus de pomme',
      countries_tags: ['en:france'],
      unique_scans_n: 5000,
    },
    {
      code: 'a2',
      product_name_fr: 'Pomme',
      countries_tags: ['en:france'],
      unique_scans_n: 80,
    },
    {
      code: 'a3',
      product_name_fr: 'Compote de pommes',
      countries_tags: ['en:france'],
      unique_scans_n: 4000,
    },
    {
      code: 'a4',
      product_name: 'Apple pie',
      countries_tags: ['en:united-states'],
      unique_scans_n: 9000,
    },
    {
      code: 'a5',
      product_name_fr: 'Pommes golden',
      countries_tags: ['en:france'],
      unique_scans_n: 600,
    },
  ],
}

describe('offSearch — URL FR / pertinence / retry', () => {
  it('buildOffSearchUrl : fr.openfoodfacts.org + lc/cc=fr + page_size large', () => {
    const url = buildOffSearchUrl({ term: 'croissant', pageSize: OFF_SEARCH_PAGE_SIZE })
    expect(url.startsWith(OFF_SEARCH_BASE_URL)).toBe(true)
    expect(url).toContain('lc=fr')
    expect(url).toContain('cc=fr')
    expect(url).toContain('search_terms=croissant')
    expect(url).toContain(`page_size=${OFF_SEARCH_PAGE_SIZE}`)
    expect(url).not.toContain('world.openfoodfacts.org')
  })

  it('croissant : nom exact / préfixe avant « mini croissant… » (popularité seule)', () => {
    const before = [...FIXTURES.croissant].sort(
      (a, b) => (b.unique_scans_n ?? 0) - (a.unique_scans_n ?? 0),
    )
    expect(offProductLabel(before[0]!)).toBe('Mini croissant au chocolat')

    const after = pickOffSearchProducts('croissant', FIXTURES.croissant, 5).map(offProductLabel)
    expect(after[0]).toBe('Croissant')
    expect(after.slice(0, 3)).toEqual(
      expect.arrayContaining(['Croissant', 'Croissant beurre', 'Croissants x4']),
    )
    expect(after.indexOf('Croissant')).toBeLessThan(after.indexOf('Mini croissant au chocolat'))
  })

  it('pain : « Pain » exact avant pain de mie / bread US', () => {
    const after = pickOffSearchProducts('pain', FIXTURES.pain, 5).map(offProductLabel)
    expect(after[0]).toBe('Pain')
    expect(after).toContain('Pain de mie complet')
    expect(after.indexOf('Pain')).toBeLessThan(after.indexOf('Whole wheat bread'))
  })

  it('yaourt : « Yaourt » / « Yaourt nature » avant « Le nature » (scans)', () => {
    const before = [...FIXTURES.yaourt].sort(
      (a, b) => (b.unique_scans_n ?? 0) - (a.unique_scans_n ?? 0),
    )
    expect(offProductLabel(before[0]!)).toBe('Le nature')

    const after = pickOffSearchProducts('yaourt', FIXTURES.yaourt, 5).map(offProductLabel)
    expect(after[0]).toBe('Yaourt')
    expect(after.slice(0, 3).join(' | ').toLowerCase()).toMatch(/yaourt/)
    expect(after.indexOf('Yaourt')).toBeLessThan(after.indexOf('Le nature'))
  })

  it('pomme : « Pomme » exact avant jus / apple pie', () => {
    const after = pickOffSearchProducts('pomme', FIXTURES.pomme, 5).map(offProductLabel)
    expect(after[0]).toBe('Pomme')
    expect(after.indexOf('Pomme')).toBeLessThan(after.indexOf('Jus de pomme'))
    expect(after.indexOf('Pomme')).toBeLessThan(after.indexOf('Apple pie'))
  })

  it('score : France + nom FR mieux classés', () => {
    const fr = scoreOffSearchProduct('pomme', {
      product_name_fr: 'Pomme golden',
      countries_tags: ['en:france'],
    })
    const us = scoreOffSearchProduct('pomme', {
      product_name: 'Apple sauce pomme',
      countries_tags: ['en:united-states'],
    })
    expect(fr).toBeLessThan(us)
  })

  it('rankOffSearchProducts est stable sur entrée vide', () => {
    expect(rankOffSearchProducts('x', [])).toEqual([])
  })

  it('fetchOffSearchJson : nouvel essai après 503 puis succès', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ products: [{ product_name_fr: 'Croissant' }] }),
      })
    const data = (await fetchOffSearchJson('https://example.test/search', {
      fetchImpl,
      timeoutMs: 1000,
      retries: 1,
    })) as { products: OffSearchProduct[] }
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(data.products[0]?.product_name_fr).toBe('Croissant')
  })

  it('fetchOffSearchJson : erreur après retries — throw (jamais [])', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    })
    await expect(
      fetchOffSearchJson('https://example.test/search', {
        fetchImpl,
        timeoutMs: 500,
        retries: 1,
      }),
    ).rejects.toThrow(/OFF_HTTP_503/)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
