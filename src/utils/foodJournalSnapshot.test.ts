import { describe, expect, it } from 'vitest'
import {
  buildFoodNutritionSnapshot,
  mealEntryFromSnapshot,
} from './foodJournalSnapshot'

describe('foodJournalSnapshot (architect)', () => {
  it('stocke un SNAPSHOT (name, portion, nutriments du jour) — pas seulement un id OFF', () => {
    const snapshot = buildFoodNutritionSnapshot({
      nom: 'POULET ROTI 250g',
      barcode: '3017620422003',
      calories: 200,
      proteines: 30,
      glucides: 0,
      lipides: 8,
      servingSize: '100 g',
      imageUrl: 'https://images.openfoodfacts.org/x.jpg',
    })

    expect(snapshot.name).toBe('Poulet Roti')
    expect(snapshot.portionLabel).toBe('100 g')
    expect(snapshot.calories).toBe(200)
    expect(snapshot.proteinG).toBe(30)
    expect(snapshot.barcode).toBe('3017620422003')

    // Même si OFF changeait demain, le snapshot local reste figé.
    const frozen = { ...snapshot }
    const laterOffWouldSay = buildFoodNutritionSnapshot({
      nom: 'POULET ROTI 250g',
      barcode: '3017620422003',
      calories: 999,
      proteines: 1,
      glucides: 1,
      lipides: 1,
      servingSize: '50 g',
    })
    expect(frozen.calories).toBe(200)
    expect(frozen.portionLabel).toBe('100 g')
    expect(laterOffWouldSay.calories).not.toBe(frozen.calories)
  })

  it('chaque aliment a son propre updatedAt (newest wins)', () => {
    const snap = buildFoodNutritionSnapshot({
      nom: 'Eau',
      calories: 0,
      proteines: 0,
      glucides: 0,
      lipides: 0,
      servingSize: null,
    })
    const a = mealEntryFromSnapshot(snap, 'lunch', 1000)
    const b = mealEntryFromSnapshot(snap, 'lunch', 2000)
    expect(a.updatedAt).toBe(1000)
    expect(b.updatedAt).toBe(2000)
    expect(a.updatedAt).not.toBe(b.updatedAt)
    expect(a.portionLabel).toBe('pour 100 g')
  })
})
