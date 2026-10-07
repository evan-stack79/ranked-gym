import { describe, expect, it } from 'vitest'
import { isAccueilGalleryEnabled } from './accueilGalleryFeatureFlag'

describe('VITE_ENABLE_ACCUEIL_GALLERY', () => {
  it('defaults OFF when unset / empty / false', () => {
    expect(isAccueilGalleryEnabled(undefined)).toBe(false)
    expect(isAccueilGalleryEnabled('')).toBe(false)
    expect(isAccueilGalleryEnabled('false')).toBe(false)
    expect(isAccueilGalleryEnabled('0')).toBe(false)
  })

  it('enables on true / 1 / yes', () => {
    expect(isAccueilGalleryEnabled('true')).toBe(true)
    expect(isAccueilGalleryEnabled('1')).toBe(true)
    expect(isAccueilGalleryEnabled('yes')).toBe(true)
    expect(isAccueilGalleryEnabled(' TRUE ')).toBe(true)
  })
})
