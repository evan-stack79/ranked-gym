import { describe, expect, it } from 'vitest'
import { isFoodAddV3Enabled } from './foodAddV3FeatureFlag'

describe('VITE_ENABLE_FOOD_ADD_V3', () => {
  it('defaults OFF when unset / empty / false', () => {
    expect(isFoodAddV3Enabled(undefined)).toBe(false)
    expect(isFoodAddV3Enabled('')).toBe(false)
    expect(isFoodAddV3Enabled('false')).toBe(false)
    expect(isFoodAddV3Enabled('0')).toBe(false)
  })

  it('ON only for true / 1 / yes', () => {
    expect(isFoodAddV3Enabled('true')).toBe(true)
    expect(isFoodAddV3Enabled('1')).toBe(true)
    expect(isFoodAddV3Enabled('yes')).toBe(true)
  })
})
