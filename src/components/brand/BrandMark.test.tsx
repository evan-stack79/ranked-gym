/** @vitest-environment jsdom */
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BrandMark,
  BRAND_MARK_COMPACT_CSS_PX,
  BRAND_MARK_COMPACT_SRC,
  BRAND_MARK_COMPACT_SRC_2X,
  BRAND_MARK_COMPACT_SRC_3X,
} from './BrandMark'

describe('BrandMark compact — netteté header', () => {
  let root: Root
  let host: HTMLDivElement

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('sert un PNG @2x/@3x sans filtre, opacity ni scale flou', () => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const ui: ReactElement = <BrandMark variant="compact" />
    act(() => {
      root.render(ui)
    })

    const img = host.querySelector('[data-brand-mark-image="compact"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe(BRAND_MARK_COMPACT_SRC_3X)
    expect(img?.getAttribute('srcset')).toContain(BRAND_MARK_COMPACT_SRC_2X)
    expect(img?.getAttribute('srcset')).toContain(BRAND_MARK_COMPACT_SRC_3X)
    expect(img?.getAttribute('srcset')).toContain('/brand-header-mark@4x.png')
    expect(img?.getAttribute('width')).toBe(String(BRAND_MARK_COMPACT_CSS_PX))
    expect(img?.getAttribute('height')).toBe(String(BRAND_MARK_COMPACT_CSS_PX))
    expect(img?.style.filter).toBe('none')
    expect(img?.style.opacity).toBe('1')
    expect(img?.style.transform).toBe('none')
    expect(img?.className).toContain('brand-mark-image')

    const word = host.querySelector('[data-brand-wordmark="compact"]')
    expect(word).not.toBeNull()
    expect(word?.textContent).toMatch(/Ranked\s*Gym/)
    const wordParent = word?.parentElement as HTMLElement | null
    expect(wordParent?.style.opacity).toBe('1')
    expect(wordParent?.style.filter).toBe('none')
  })
})
