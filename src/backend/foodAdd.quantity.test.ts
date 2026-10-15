/**
 * Limites quantité — source unique validateFoodQuantity (app + serveur).
 * Rejets : 0, -5, 999999, empty, 2001 g, 1.5 g, 0 pièce, 0.3 pièce,
 * 50.5 / 1000 pièces, pieces×servingGrams > 2000.
 * Acceptés : 1 g, 2000 g, 0.5 / 50 pièces.
 */
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import { __test } from '../../convex/foodAdd'
import {
  FOOD_ADD_QUANTITY_INVALID,
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_BELOW_MIN,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
  FOOD_ADD_QTY_MSG_INVALID_PIECES,
  foodAddQuantityUserMessage,
  validateFoodQuantity,
} from '../../convex/lib/foodAddQuantity'
import { mapFoodAddQuantityError } from '../services/alimentsService'

describe('validateFoodQuantity — source unique app + serveur', () => {
  it('rejette 0 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('below_min')
  })

  it('rejette -5 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: -5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('below_min')
  })

  it('rejette 999999 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 999999 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('above_max')
  })

  it('rejette empty (champ vide)', () => {
    const r = validateFoodQuantity({ unit: 'g', value: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('below_min')
  })

  it('rejette 2001 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 2001 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('above_max')
  })

  it('rejette 1.5 g (pas entier) → message grams', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 1.5 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('invalid')
      expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(FOOD_ADD_QTY_MSG_INVALID_GRAMS)
      expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(
        'Entre un nombre entier de grammes.',
      )
    }
  })

  it('rejette 0 pièce', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('below_min')
  })

  it('rejette 0.3 pièce (pas pas de 0.5)', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 0.3 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid')
  })

  it('rejette 1.3 pièce → message pieces', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 1.3 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('invalid')
      expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(FOOD_ADD_QTY_MSG_INVALID_PIECES)
      expect(foodAddQuantityUserMessage(r.reason, r.unit)).toBe(
        'Utilise des demi-pièces : 0,5, 1, 1,5…',
      )
    }
  })

  it('rejette 50.5 pièces', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 50.5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('above_max')
  })

  it('rejette 1000 pièces', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 1000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('above_max')
  })

  it('rejette pieces × servingGrams > 2000', () => {
    const r = validateFoodQuantity({
      unit: 'pieces',
      value: 50,
      servingGrams: 50,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('above_max')
  })

  it('accepte 1 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 1 })
    expect(r).toEqual({ ok: true, unit: 'g', grams: 1 })
  })

  it('accepte 2000 g', () => {
    const r = validateFoodQuantity({ unit: 'g', value: 2000 })
    expect(r).toEqual({ ok: true, unit: 'g', grams: 2000 })
  })

  it('accepte 0.5 pièce', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 0.5 })
    expect(r).toEqual({ ok: true, unit: 'pieces', pieces: 0.5 })
  })

  it('accepte 50 pièces', () => {
    const r = validateFoodQuantity({ unit: 'pieces', value: 50 })
    expect(r).toEqual({ ok: true, unit: 'pieces', pieces: 50 })
  })

  it('serveur (__test) expose la même validateFoodQuantity', () => {
    expect(__test.validateFoodQuantity).toBe(validateFoodQuantity)
    expect(__test.FOOD_ADD_QUANTITY_INVALID).toBe(FOOD_ADD_QUANTITY_INVALID)
    const bad = __test.validateFoodQuantity({ unit: 'g', value: 2001 })
    expect(bad.ok).toBe(false)
  })

  it('message serveur mappé → exact FR (jamais le code brut)', () => {
    expect(
      mapFoodAddQuantityError(
        new ConvexError({ code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min' }),
      ),
    ).toBe(FOOD_ADD_QTY_MSG_BELOW_MIN)
    expect(
      mapFoodAddQuantityError(
        new ConvexError({ code: FOOD_ADD_QUANTITY_INVALID, reason: 'above_max' }),
      ),
    ).toBe(FOOD_ADD_QTY_MSG_ABOVE_MAX)
    expect(
      mapFoodAddQuantityError(
        new ConvexError({
          code: FOOD_ADD_QUANTITY_INVALID,
          reason: 'invalid',
          unit: 'g',
        }),
      ),
    ).toBe(FOOD_ADD_QTY_MSG_INVALID_GRAMS)
    expect(
      mapFoodAddQuantityError(
        new ConvexError({ code: FOOD_ADD_QUANTITY_INVALID, reason: 'above_max' }),
      ),
    ).toBe('Vérifie ce chiffre, il semble trop grand.')
    expect(
      mapFoodAddQuantityError(
        new ConvexError({ code: FOOD_ADD_QUANTITY_INVALID, reason: 'below_min' }),
      ),
    ).toBe('Entre une quantité plus grande que 0.')
    expect(mapFoodAddQuantityError(new ConvexError({ code: 'FOOD_ADD_ACCESS_DENIED' }))).toBeNull()
  })
})
