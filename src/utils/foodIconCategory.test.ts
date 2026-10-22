import { describe, expect, it } from 'vitest'
import { resolveFoodIconCategory } from './foodIconCategory'

describe('resolveFoodIconCategory', () => {
  it('mappe tags OFF → catégories icône', () => {
    expect(resolveFoodIconCategory(['en:croissants'])).toBe('viennoiserie')
    expect(resolveFoodIconCategory(['en:breads'])).toBe('pain')
    expect(resolveFoodIconCategory(['en:yogurts'])).toBe('produit_laitier')
    expect(resolveFoodIconCategory(['en:fruits'])).toBe('fruit')
    expect(resolveFoodIconCategory(['en:vegetables'])).toBe('legume')
    expect(resolveFoodIconCategory(['en:meats'])).toBe('viande')
    expect(resolveFoodIconCategory(['en:fishes'])).toBe('poisson')
    expect(resolveFoodIconCategory(['en:beverages'])).toBe('boisson')
    expect(resolveFoodIconCategory(['en:meals'])).toBe('plat')
    expect(resolveFoodIconCategory(['en:snacks'])).toBe('snack')
  })

  it('tags vides / inconnus → autre', () => {
    expect(resolveFoodIconCategory([])).toBe('autre')
    expect(resolveFoodIconCategory(null)).toBe('autre')
    expect(resolveFoodIconCategory(['en:unknown-xyz'])).toBe('autre')
  })
})
