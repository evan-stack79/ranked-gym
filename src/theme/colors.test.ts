import { describe, expect, it } from 'vitest'
import { BRAND_COLOR, BRAND_COLOR_HOVER, RADIX_RED } from './colors'

describe('Radix brand tokens', () => {
  it('utilise l’accent dark E22400 (step 9)', () => {
    expect(RADIX_RED[9]).toBe('#e22400')
    expect(BRAND_COLOR).toBe('#e22400')
    expect(BRAND_COLOR_HOVER).toBe('#d20000')
  })
})
