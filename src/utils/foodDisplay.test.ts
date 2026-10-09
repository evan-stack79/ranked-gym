import { describe, expect, it } from 'vitest'
import {
  cleanupFoodName,
  DEFAULT_PORTION_LABEL,
  formatOffServingSize,
  parseGramsFromServingSize,
  scaleNutrientPer100g,
} from './foodDisplay'

describe('foodDisplay (scientific checker)', () => {
  it('portion = serving_size OFF (serving→portion, espace unités) sinon « pour 100 g » ; name cleanup ne change jamais la portion', () => {
    expect(formatOffServingSize('30g')).toBe('30 g')
    expect(formatOffServingSize('1 serving (45g)')).toBe('1 portion (45 g)')
    expect(formatOffServingSize('2 servings')).toBe('2 portions')
    expect(formatOffServingSize(null)).toBe(DEFAULT_PORTION_LABEL)
    expect(formatOffServingSize('')).toBe(DEFAULT_PORTION_LABEL)
    expect(formatOffServingSize(undefined)).toBe(DEFAULT_PORTION_LABEL)

    const rawName = 'YAOURT NATURE 250g'
    const cleaned = cleanupFoodName(rawName)
    expect(cleaned).toBe('Yaourt Nature')
    // Portion indépendante du nom : même si le nom portait « 250g », la portion vient de serving_size.
    expect(formatOffServingSize('125 g')).toBe('125 g')
    expect(formatOffServingSize(null)).toBe(DEFAULT_PORTION_LABEL)
    expect(cleaned).not.toContain('250')
  })

  it('parseGrams / scale : jamais inventé si ambigu', () => {
    expect(parseGramsFromServingSize('30 g')).toBe(30)
    expect(parseGramsFromServingSize('1 portion')).toBeNull()
    expect(parseGramsFromServingSize('250 ml')).toBeNull()
    expect(scaleNutrientPer100g(200, 50, 0)).toBe(100)
    expect(scaleNutrientPer100g(null, 50, 0)).toBeNull()
  })
})
