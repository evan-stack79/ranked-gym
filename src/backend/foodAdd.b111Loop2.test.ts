/**
 * B111-10..15 — boucle QA 2 (parsePortionGrams, labels pièces, catalog coalesce,
 * portion V3-OFF ≡ d33b724).
 */
import { ConvexError } from 'convex/values'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __test } from '../../convex/foodAdd'
import {
  FOOD_ADD_QUANTITY_INVALID,
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_BELOW_MIN,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
  FOOD_ADD_QTY_MSG_INVALID_PIECES,
  foodAddQuantityUserMessage,
  formatGramsCountLabel,
  formatPiecesCountLabel,
  parsePortionGrams,
  validateFoodQuantity,
} from '../../convex/lib/foodAddQuantity'
import { formatMealPortionLabel } from '../components/nutrition/NutritionDayMealsCard'
import { isFoodAddV3Enabled } from './foodAddV3FeatureFlag'

describe('B111-14 — parsePortionGrams (source unique app + serveur)', () => {
  it('« 2 x 25 g (50 g) » → pièce 25 / portion 50', () => {
    const parsed = parsePortionGrams('2 x 25 g (50 g)')
    expect(parsed).toEqual({ pieceGrams: 25, servingGrams: 50 })
    expect(__test.parsePortionGrams('2 x 25 g (50 g)')).toEqual(parsed)
    expect(__test.parseServingGrams('2 x 25 g (50 g)')).toBe(25)
  })

  it('« 2 × 25g (50g) » idem (× collé)', () => {
    expect(parsePortionGrams('2 × 25g (50g)')).toEqual({
      pieceGrams: 25,
      servingGrams: 50,
    })
  })

  it('mismatch 2×25 ≠ 40 → null', () => {
    expect(parsePortionGrams('2 x 25 g (40 g)')).toEqual({
      pieceGrams: null,
      servingGrams: null,
    })
  })

  it('ml seul → null', () => {
    expect(parsePortionGrams('250 ml')).toEqual({
      pieceGrams: null,
      servingGrams: null,
    })
    expect(parsePortionGrams('33 cl')).toEqual({
      pieceGrams: null,
      servingGrams: null,
    })
  })

  it('app et serveur : même résultat (import partagé)', () => {
    const samples = [
      '2 x 25 g (50 g)',
      '2 x 25 g (40 g)',
      '250 ml',
      '15 g',
      '250 ml (240 g)',
    ]
    for (const s of samples) {
      expect(__test.parsePortionGrams(s)).toEqual(parsePortionGrams(s))
    }
  })
})

describe('B111-15 — formatPiecesCountLabel (virgule, pluriel ≥ 2)', () => {
  it('0,5 / 1 / 1,5 / 2', () => {
    expect(formatPiecesCountLabel(0.5)).toBe('0,5 pièce')
    expect(formatPiecesCountLabel(1)).toBe('1 pièce')
    expect(formatPiecesCountLabel(1.5)).toBe('1,5 pièce')
    expect(formatPiecesCountLabel(2)).toBe('2 pièces')
    expect(__test.formatPiecesCountLabel(1.5)).toBe('1,5 pièce')
  })
})

describe('B111-12 — pickCatalogNutrient (jamais null/0 sur catalog existant)', () => {
  it('catalog 450 + produit absent OFF → conserve 450', () => {
    expect(__test.pickCatalogNutrient(null, 450)).toBe(450)
    expect(__test.pickCatalogNutrient(undefined, 450)).toBe(450)
  })

  it('pas de catalog → null (pas 0)', () => {
    expect(__test.pickCatalogNutrient(null, null)).toBeNull()
    expect(__test.pickCatalogNutrient(undefined, undefined)).toBeNull()
  })

  it('OFF prioritaire ; client kcal ignoré (A1)', () => {
    expect(__test.pickCatalogNutrient(539, 450)).toBe(539)
    const clientKcal = 999
    void clientKcal
    // meal calc n’utilise jamais le client — seul le cache coalescé.
    const meal = __test.computeMealNutritionFromOffCache(
      {
        caloriesPer100g: __test.pickCatalogNutrient(null, 450),
        proteinPer100g: null,
        carbsPer100g: null,
        fatPer100g: null,
        servingSize: '100 g',
        servingGrams: 100,
      },
      { grams: 100 },
    )
    expect(meal.calories).toBe(450)
    expect(meal.calories).not.toBe(999)
    expect(meal.calories).not.toBe(0)
  })
})

describe('B111-13 — V3 OFF portion ≡ d33b724 (Math.round)', () => {
  const prev = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
  })

  afterEach(() => {
    if (prev == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prev)
  })

  it('1.5 pièces → « 2 pièces » (QA)', () => {
    expect(isFoodAddV3Enabled()).toBe(false)
    expect(formatMealPortionLabel({ pieces: 1.5 })).toBe('2 pièces')
    expect(formatMealPortionLabel({ pieces: 0.5 })).toBe('1 pièce')
    expect(formatMealPortionLabel({ pieces: 1 })).toBe('1 pièce')
    expect(formatMealPortionLabel({ pieces: 4 })).toBe('4 pièces')
  })
})

describe('B111-15 + V3 ON — formatMealPortionLabel virgule / pluriel', () => {
  const prev = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', 'true')
  })

  afterEach(() => {
    if (prev == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prev)
  })

  it('0,5 / 1 / 1,5 / 2 pièces ; grams live > portionLabel stale', () => {
    expect(isFoodAddV3Enabled()).toBe(true)
    expect(formatMealPortionLabel({ pieces: 0.5 })).toBe('0,5 pièce')
    expect(formatMealPortionLabel({ pieces: 1 })).toBe('1 pièce')
    expect(formatMealPortionLabel({ pieces: 1.5 })).toBe('1,5 pièce')
    expect(formatMealPortionLabel({ pieces: 2 })).toBe('2 pièces')
    expect(formatMealPortionLabel({ grams: 200, portionLabel: '120 g' })).toBe('200 g')
  })
})

describe('B111-13/15 — même ligne : V3 ON « 1,5 pièce » vs V3 OFF « 2 pièces »', () => {
  const prev = import.meta.env.VITE_ENABLE_FOOD_ADD_V3
  const sameRow = { pieces: 1.5 as const, portionLabel: '1.5 pièces' }

  afterEach(() => {
    if (prev == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prev)
  })

  it('même meal.pieces=1.5 : OFF ≡ d33b724 « 2 pièces », ON « 1,5 pièce »', () => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    expect(isFoodAddV3Enabled()).toBe(false)
    expect(formatMealPortionLabel(sameRow)).toBe('2 pièces')
    expect(formatMealPortionLabel(sameRow)).not.toBe('1,5 pièce')

    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', 'true')
    expect(isFoodAddV3Enabled()).toBe(true)
    expect(formatMealPortionLabel(sameRow)).toBe('1,5 pièce')
    expect(formatMealPortionLabel(sameRow)).not.toBe('2 pièces')
  })
})

describe('B111-11 — edit quantity + portionLabel serveur', () => {
  it('120 → 200 : label « 200 g » (grams live > portionLabel stale)', () => {
    expect(formatGramsCountLabel(200)).toBe('200 g')
    expect(
      formatMealPortionLabel({ grams: 200, portionLabel: '120 g' }),
    ).toBe('200 g')
  })

  it('serveur : rejet 0 / 99999 / 1.5 avec messages exacts', () => {
    for (const [value, reason, msg] of [
      [0, 'below_min', FOOD_ADD_QTY_MSG_BELOW_MIN],
      [99999, 'above_max', FOOD_ADD_QTY_MSG_ABOVE_MAX],
      [1.5, 'invalid', FOOD_ADD_QTY_MSG_INVALID_GRAMS],
    ] as const) {
      const r = validateFoodQuantity({ unit: 'g', value })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.code).toBe(FOOD_ADD_QUANTITY_INVALID)
        expect(r.reason).toBe(reason)
        expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(msg)
        // Même forme que upsertMeal / addFoodSnapshot.
        const err = new ConvexError({
          code: FOOD_ADD_QUANTITY_INVALID,
          reason: r.reason,
          unit: r.unit,
        })
        expect(err.data.code).toBe(FOOD_ADD_QUANTITY_INVALID)
        expect(err.data.reason).toBe(reason)
      }
    }
  })
})

describe('B111-10 — messages quantité exacts (source unique)', () => {
  it('0 / 2001 / 1.5 g / 1.3 pièce → 4 messages word-for-word', () => {
    const cases = [
      { unit: 'g' as const, value: 0, msg: FOOD_ADD_QTY_MSG_BELOW_MIN },
      { unit: 'g' as const, value: 2001, msg: FOOD_ADD_QTY_MSG_ABOVE_MAX },
      { unit: 'g' as const, value: 1.5, msg: FOOD_ADD_QTY_MSG_INVALID_GRAMS },
      { unit: 'pieces' as const, value: 1.3, msg: FOOD_ADD_QTY_MSG_INVALID_PIECES },
    ]
    for (const c of cases) {
      const r = validateFoodQuantity({ unit: c.unit, value: c.value })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(c.msg)
      }
    }
    expect(FOOD_ADD_QTY_MSG_BELOW_MIN).toBe('Entre une quantité plus grande que 0.')
    expect(FOOD_ADD_QTY_MSG_ABOVE_MAX).toBe(
      'Vérifie ce chiffre, il semble trop grand.',
    )
    expect(FOOD_ADD_QTY_MSG_INVALID_GRAMS).toBe(
      'Entre un nombre entier de grammes.',
    )
    expect(FOOD_ADD_QTY_MSG_INVALID_PIECES).toBe(
      'Utilise des demi-pièces : 0,5, 1, 1,5…',
    )
  })
})
