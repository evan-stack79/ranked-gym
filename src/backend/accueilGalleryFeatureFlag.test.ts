import { describe, expect, it } from 'vitest'
import { isAccueilGalleryEnabled } from './accueilGalleryFeatureFlag'

describe('VITE_ENABLE_ACCUEIL_GALLERY', () => {
  it('defaults ON when unset / empty', () => {
    expect(isAccueilGalleryEnabled(undefined)).toBe(true)
    expect(isAccueilGalleryEnabled('')).toBe(true)
    expect(isAccueilGalleryEnabled('   ')).toBe(true)
  })

  it('disables on false / 0 / no', () => {
    expect(isAccueilGalleryEnabled('false')).toBe(false)
    expect(isAccueilGalleryEnabled('0')).toBe(false)
    expect(isAccueilGalleryEnabled('no')).toBe(false)
  })

  it('enables on true / 1 / yes', () => {
    expect(isAccueilGalleryEnabled('true')).toBe(true)
    expect(isAccueilGalleryEnabled('1')).toBe(true)
    expect(isAccueilGalleryEnabled('yes')).toBe(true)
    expect(isAccueilGalleryEnabled(' TRUE ')).toBe(true)
  })
})
