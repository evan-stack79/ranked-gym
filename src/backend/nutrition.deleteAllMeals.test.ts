import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('deleteAllMyMeals — ownership, autorisé comptes bloqués', () => {
  const source = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')

  it('expose countActiveMeals et deleteAllMyMeals sans assertFoodWriteAccess', () => {
    expect(source).toContain('export const countActiveMeals')
    expect(source).toContain('export const deleteAllMyMeals')

    const countIdx = source.indexOf('export const countActiveMeals')
    const countBlock = source.slice(countIdx, countIdx + 900)
    expect(countBlock).toContain('sessionUserId')
    expect(countBlock).not.toContain('assertFoodWriteAccess')

    const delIdx = source.indexOf('export const deleteAllMyMeals')
    const delBlock = source.slice(delIdx, delIdx + 1200)
    expect(delBlock).toContain('sessionUserId')
    expect(delBlock).toContain('assertUserOwnership')
    expect(delBlock).not.toContain('assertFoodWriteAccess')
    expect(delBlock).toContain('deletedAt')
  })
})
