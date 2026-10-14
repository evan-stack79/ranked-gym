import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Contrat : toute mutation / action food « ancienne » nutrition
 * doit appeler la garde mineur/TCA (assertFoodWriteAccess ou assertActionSession).
 */
describe('nutrition.ts — garde accès sur les anciennes fonctions food', () => {
  const source = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')

  it('définit assertFoodWriteAccess et assertActionSession avec checkFoodAddAccess', () => {
    expect(source).toContain('assertFoodWriteAccess')
    expect(source).toContain('assertActionSession')
    expect(source).toContain('assertFoodAddAccessFromStoredProfile')
    expect(source).toContain('checkFoodAddAccess')
  })

  it('protège upsertMeal / deleteMeal / upsertFoodSelection / setFoodFavorite', () => {
    for (const name of [
      'export const upsertMeal',
      'export const deleteMeal',
      'export const upsertFoodSelection',
      'export const setFoodFavorite',
    ]) {
      expect(source).toContain(name)
    }
    // Chaque handler food write appelle assertFoodWriteAccess
    const foodWriteHandlers = source.match(
      /export const (upsertMeal|deleteMeal|upsertFoodSelection|setFoodFavorite) = mutation\([\s\S]*?handler: async \(ctx, args\) => \{[\s\S]*?\n  \},\n\}\)/g,
    )
    expect(foodWriteHandlers?.length).toBe(4)
    for (const block of foodWriteHandlers ?? []) {
      expect(block).toContain('assertFoodWriteAccess')
    }
  })

  it('protège fetchOpenFoodFactsByBarcode et searchOpenFoodFacts via assertActionSession', () => {
    const barcodeIdx = source.indexOf('export const fetchOpenFoodFactsByBarcode')
    const searchIdx = source.indexOf('export const searchOpenFoodFacts')
    expect(barcodeIdx).toBeGreaterThan(-1)
    expect(searchIdx).toBeGreaterThan(-1)
    const barcodeBlock = source.slice(barcodeIdx, barcodeIdx + 600)
    const searchBlock = source.slice(searchIdx, searchIdx + 600)
    expect(barcodeBlock).toContain('assertActionSession')
    expect(searchBlock).toContain('assertActionSession')
  })
})
