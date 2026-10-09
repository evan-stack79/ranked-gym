import { describe, expect, it } from 'vitest'
import {
  FOOD_CATEGORIES,
  hitMatchesFoodCategory,
  primaryOffTagForCategory,
} from './foodCategories'

describe('foodCategories', () => {
  it('expose des libellés neutres et filtre par tags OFF', () => {
    expect(FOOD_CATEGORIES.map((c) => c.label)).toEqual([
      'Tout',
      'Fruits',
      'Boissons',
      'Repas',
      'Snacks',
      'Laitages',
    ])
    expect(hitMatchesFoodCategory('all', [])).toBe(true)
    expect(hitMatchesFoodCategory('fruits', ['en:fruits', 'en:fresh-fruits'])).toBe(true)
    expect(hitMatchesFoodCategory('fruits', ['en:sodas'])).toBe(false)
    expect(primaryOffTagForCategory('dairy')).toBe('en:dairies')
    expect(primaryOffTagForCategory('all')).toBeNull()
  })
})
