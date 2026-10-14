import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertFoodAddAccessFromStoredProfile,
  FOOD_ADD_ACCESS_AGE_REQUIRED,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
} from '../../convex/lib/foodAddAccess'

type Row = { userId: string; profileJson: unknown }

function fakeCtx(row: Row | null) {
  return {
    db: {
      query(_table: string) {
        return {
          withIndex(_name: string, _fn: (q: { eq: (a: string, b: string) => unknown }) => unknown) {
            return {
              first: async () => row,
            }
          },
        }
      },
    },
  }
}

describe('N-01 — droits repas (add/edit vs delete)', () => {
  const nutritionSource = readFileSync(
    new URL('../../convex/nutrition.ts', import.meta.url),
    'utf8',
  )

  it('compte mineur / TCA : add/edit refusés ; deleteMeal sans garde accès', async () => {
    const minor = await assertFoodAddAccessFromStoredProfile(
      fakeCtx({ userId: 'u1', profileJson: { age: 16 } }) as never,
      'u1',
    )
    expect(minor.ok).toBe(false)
    if (!minor.ok) expect(minor.error).toBe(FOOD_ADD_ACCESS_DENIED_MINOR)

    const tca = await assertFoodAddAccessFromStoredProfile(
      fakeCtx({
        userId: 'u1',
        profileJson: { age: 30, healthAnswer: 'situations', declaredEatingDisorder: true },
      }) as never,
      'u1',
    )
    expect(tca.ok).toBe(false)
    if (!tca.ok) expect(tca.error).toBe(FOOD_ADD_ACCESS_DENIED_TCA)

    // upsertMeal garde ; deleteMeal non
    const upsertIdx = nutritionSource.indexOf('export const upsertMeal')
    expect(nutritionSource.slice(upsertIdx, upsertIdx + 1800)).toContain('assertFoodWriteAccess')
    const deleteIdx = nutritionSource.indexOf('export const deleteMeal')
    const deleteBlock = nutritionSource.slice(deleteIdx, deleteIdx + 1800)
    expect(deleteBlock).not.toContain('assertFoodWriteAccess')
    expect(deleteBlock).toContain('sessionUserId')
  })

  it('âge manquant → erreur claire age_required (pas mineur silencieux)', async () => {
    const result = await assertFoodAddAccessFromStoredProfile(
      fakeCtx({ userId: 'u1', profileJson: { declaredEatingDisorder: false } }) as never,
      'u1',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(FOOD_ADD_ACCESS_AGE_REQUIRED)
    expect(result.ok === false && result.error).toBe('age_required')
  })
})
