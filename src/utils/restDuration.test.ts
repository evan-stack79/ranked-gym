import { describe, expect, it } from 'vitest'
import { CANONICAL_REST_SEC, resolveRestDuration } from './restDuration'

describe('resolveRestDuration', () => {
  it('priorité exercice > préférence > défaut 90 s', () => {
    expect(
      resolveRestDuration({
        exerciseRestSec: 45,
        preferredRestSec: 180,
      }),
    ).toBe(45)
    expect(resolveRestDuration({ preferredRestSec: 120 })).toBe(120)
    expect(resolveRestDuration({})).toBe(CANONICAL_REST_SEC)
    expect(CANONICAL_REST_SEC).toBe(90)
  })

  it('ignore les valeurs invalides sans inventer 3 min', () => {
    expect(resolveRestDuration({ exerciseRestSec: 0, preferredRestSec: 90 })).toBe(90)
    expect(resolveRestDuration({ exerciseRestSec: Number.NaN })).toBe(90)
    expect(resolveRestDuration({ sessionRestSec: 75, preferredRestSec: 90 })).toBe(75)
  })
})
