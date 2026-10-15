/**
 * A3 — ConvexError({ code, reason }) → messages FR via error.data (jamais le texte brut).
 */
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import {
  FOOD_ADD_QUANTITY_INVALID,
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_BELOW_MIN,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
  FOOD_ADD_QTY_MSG_INVALID_PIECES,
  foodAddQuantityUserMessage,
  validateFoodQuantity,
} from '../../convex/lib/foodAddQuantity'
import {
  mapAccessError,
  mapFoodAddQuantityError,
} from '../services/alimentsService'
import { FOOD_ADD_ACCESS_AGE_REQUIRED } from '../../convex/lib/foodAddAccess'

describe('ConvexError FOOD_ADD_* → error.data (A3)', () => {
  it('FOOD_ADD_QUANTITY_INVALID below_min → message exact', () => {
    const error = new ConvexError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: 'below_min',
    })
    expect(mapFoodAddQuantityError(error)).toBe(FOOD_ADD_QTY_MSG_BELOW_MIN)
    expect(mapFoodAddQuantityError(error)).toBe('Entre une quantité plus grande que 0.')
  })

  it('FOOD_ADD_QUANTITY_INVALID above_max → message exact', () => {
    const error = new ConvexError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: 'above_max',
    })
    expect(mapFoodAddQuantityError(error)).toBe(FOOD_ADD_QTY_MSG_ABOVE_MAX)
    expect(mapFoodAddQuantityError(error)).toBe('Vérifie ce chiffre, il semble trop grand.')
  })

  it('1.5 g → message grams invalid exact', () => {
    const checked = validateFoodQuantity({ unit: 'g', value: 1.5 })
    expect(checked.ok).toBe(false)
    if (checked.ok) return
    expect(foodAddQuantityUserMessage(checked.reason, checked.unit)).toBe(
      FOOD_ADD_QTY_MSG_INVALID_GRAMS,
    )
    expect(foodAddQuantityUserMessage(checked.reason, checked.unit)).toBe(
      'Entre un nombre entier de grammes.',
    )
    const error = new ConvexError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: 'invalid',
      unit: 'g',
    })
    expect(mapFoodAddQuantityError(error)).toBe('Entre un nombre entier de grammes.')
  })

  it('1.3 pièce → message pieces invalid exact', () => {
    const checked = validateFoodQuantity({ unit: 'pieces', value: 1.3 })
    expect(checked.ok).toBe(false)
    if (checked.ok) return
    expect(foodAddQuantityUserMessage(checked.reason, checked.unit)).toBe(
      FOOD_ADD_QTY_MSG_INVALID_PIECES,
    )
    expect(foodAddQuantityUserMessage(checked.reason, checked.unit)).toBe(
      'Utilise des demi-pièces : 0,5, 1, 1,5…',
    )
    const error = new ConvexError({
      code: FOOD_ADD_QUANTITY_INVALID,
      reason: 'invalid',
      unit: 'pieces',
    })
    expect(mapFoodAddQuantityError(error)).toBe('Utilise des demi-pièces : 0,5, 1, 1,5…')
  })

  it('access age_required (data.code) → message âge exact', () => {
    const error = new ConvexError({ code: FOOD_ADD_ACCESS_AGE_REQUIRED })
    const mapped = mapAccessError(error)
    expect(mapped).toBeInstanceOf(Error)
    expect(mapped!.message).toBe('Indique ton âge pour ajouter un aliment.')
  })

  it('access FOOD_ADD_ACCESS_DENIED_MINOR (data.code) → indisponible', () => {
    const error = new ConvexError({ code: 'FOOD_ADD_ACCESS_DENIED_MINOR' })
    const mapped = mapAccessError(error)
    expect(mapped!.message).toBe('Ajout d’aliment indisponible pour ce compte.')
  })

  it('FOOD_ADD_ACCESS_DENIED ne mappe pas en quantity error', () => {
    const error = new ConvexError({ code: 'FOOD_ADD_ACCESS_DENIED' })
    expect(mapFoodAddQuantityError(error)).toBeNull()
  })
})
