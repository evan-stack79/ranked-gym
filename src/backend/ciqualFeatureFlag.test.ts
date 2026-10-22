import { describe, expect, it } from 'vitest'
import { isCiqualEnabled } from './ciqualFeatureFlag'

describe('VITE_ENABLE_CIQUAL', () => {
  it('OFF par défaut', () => {
    expect(isCiqualEnabled(undefined)).toBe(false)
    expect(isCiqualEnabled('')).toBe(false)
    expect(isCiqualEnabled('false')).toBe(false)
  })

  it('ON seulement si true/1/yes', () => {
    expect(isCiqualEnabled('true')).toBe(true)
    expect(isCiqualEnabled('1')).toBe(true)
  })
})
