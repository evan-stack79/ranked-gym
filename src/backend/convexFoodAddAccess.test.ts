import { describe, expect, it } from 'vitest'
import {
  assertFoodAddAccessFromStoredProfile,
  extractDiabetesFromProfileJson,
  extractEatingDisorderFromProfileJson,
  FOOD_ADD_ACCESS_AGE_REQUIRED,
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
  isAdultStoredAge,
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

describe('Convex foodAddAccess (serveur)', () => {
  it('refuse un profil mineur stocké', async () => {
    const ctx = fakeCtx({
      userId: 'u1',
      profileJson: { age: 16, declaredEatingDisorder: false },
    })
    const result = await assertFoodAddAccessFromStoredProfile(ctx as never, 'u1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(FOOD_ADD_ACCESS_DENIED_MINOR)
  })

  it('refuse un profil TCA stocké (même adulte)', async () => {
    const ctx = fakeCtx({
      userId: 'u1',
      profileJson: {
        age: 30,
        healthAnswer: 'situations',
        declaredEatingDisorder: true,
      },
    })
    const result = await assertFoodAddAccessFromStoredProfile(ctx as never, 'u1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(FOOD_ADD_ACCESS_DENIED_TCA)
  })

  it('autorise un diabétique (âge adulte, pas de TCA)', async () => {
    const ctx = fakeCtx({
      userId: 'u1',
      profileJson: {
        age: 40,
        healthAnswer: 'none',
        declaredDiabetes: true,
        declaredEatingDisorder: false,
      },
    })
    const result = await assertFoodAddAccessFromStoredProfile(ctx as never, 'u1')
    expect(result).toEqual({ ok: true, diabetes: true })
  })

  it('refuse un âge inconnu avec age_required (pas mineur)', async () => {
    const ctx = fakeCtx({
      userId: 'u1',
      profileJson: { declaredEatingDisorder: false },
    })
    const result = await assertFoodAddAccessFromStoredProfile(ctx as never, 'u1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(FOOD_ADD_ACCESS_AGE_REQUIRED)
  })

  it('helpers lecture profil', () => {
    expect(isAdultStoredAge(18)).toBe(true)
    expect(isAdultStoredAge(17)).toBe(false)
    expect(isAdultStoredAge(null)).toBe(false)
    expect(isAdultStoredAge(undefined)).toBe(false)
    expect(
      extractEatingDisorderFromProfileJson({
        healthAnswer: 'situations',
        declaredEatingDisorder: true,
      }),
    ).toBe(true)
    expect(
      extractEatingDisorderFromProfileJson({
        healthAnswer: 'none',
        declaredEatingDisorder: true,
      }),
    ).toBe(false)
    expect(extractDiabetesFromProfileJson({ declaredDiabetes: true })).toBe(true)
  })
})
