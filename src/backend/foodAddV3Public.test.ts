/**
 * Garde permanente : les formes app-facing V3 ne portent jamais de kcal / macros.
 * Les queries legacy (listJournalEntries / search OFF) restent inchangées.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS,
  foodAddV3ResponseContainsForbiddenNutrition,
  toFoodAddV3PublicHit,
  toFoodAddV3PublicMeal,
} from '../../convex/lib/foodAddPublic'

describe('foodAdd V3 public response — no kcal / macros', () => {
  it('toFoodAddV3PublicHit n’expose aucune clé nutritionnelle', () => {
    const hit = toFoodAddV3PublicHit({
      barcode: '3017620422003',
      nom: 'Pâte à tartiner',
      brands: 'Nutella',
      servingSize: '15 g',
      categoriesTags: ['en:spreads'],
      imageUrl: 'https://example.convex.cloud/x.png',
      provenance: 'open_food_facts',
      fetchedAt: 1,
    })
    expect(foodAddV3ResponseContainsForbiddenNutrition(hit)).toBe(false)
    for (const key of FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS) {
      expect(hit).not.toHaveProperty(key)
    }
    expect(hit.portionLabel).toBe('15 g')
    expect(hit.nom).toBe('Pâte à tartiner')
  })

  it('toFoodAddV3PublicMeal n’expose aucune clé nutritionnelle', () => {
    const meal = toFoodAddV3PublicMeal({
      mealId: 'm1',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Riz',
      grams: 120,
      portionLabel: '120 g',
      updatedAt: 1,
    })
    expect(foodAddV3ResponseContainsForbiddenNutrition(meal)).toBe(false)
    for (const key of FOOD_ADD_V3_FORBIDDEN_RESPONSE_KEYS) {
      expect(meal).not.toHaveProperty(key)
    }
  })

  it('détecte calories / proteinG / nutriments / energy dans une forme contaminée', () => {
    expect(foodAddV3ResponseContainsForbiddenNutrition({ calories: 10 })).toBe(true)
    expect(foodAddV3ResponseContainsForbiddenNutrition({ proteinG: 1 })).toBe(true)
    expect(foodAddV3ResponseContainsForbiddenNutrition({ hits: [{ nutriments: {} }] })).toBe(true)
    expect(foodAddV3ResponseContainsForbiddenNutrition({ energy: 1 })).toBe(true)
    expect(foodAddV3ResponseContainsForbiddenNutrition({ kcal: 1 })).toBe(true)
  })

  it('listJournalEntriesV3 existe ; listJournalEntries legacy conserve calories', () => {
    const foodAdd = readFileSync(new URL('../../convex/foodAdd.ts', import.meta.url), 'utf8')
    const nutrition = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')
    expect(foodAdd).toContain('export const listJournalEntriesV3')
    expect(foodAdd).toContain('toFoodAddV3PublicHit')
    expect(foodAdd).toContain('foodHitPublicValidator')
    expect(foodAdd).not.toMatch(/hits\.push\(\{[\s\S]*calories:\s*mapped\.calories/)
    expect(nutrition).toContain('export const listJournalEntries')
    expect(nutrition).toMatch(/calories:\s*row\.calories/)
  })
})
