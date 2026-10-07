/** @vitest-environment jsdom */
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { BrandMark, BRAND_MARK_COMPACT_CSS_PX, BRAND_MARK_HERO_SRC } from './BrandMark'

describe('BrandMark compact — SVG + texte réel', () => {
  let root: Root
  let host: HTMLDivElement

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('rend un SVG inline + wordmark texte, sans PNG ni filter/opacity', () => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const ui: ReactElement = <BrandMark variant="compact" />
    act(() => {
      root.render(ui)
    })

    const svg = host.querySelector('[data-brand-mark-svg="compact"]') as SVGSVGElement | null
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('width')).toBe(String(BRAND_MARK_COMPACT_CSS_PX))
    expect(svg?.getAttribute('height')).toBe(String(BRAND_MARK_COMPACT_CSS_PX))
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0)
    expect(host.querySelector('[data-brand-mark-image="compact"]')).toBeNull()
    expect(host.querySelector('img')).toBeNull()

    const word = host.querySelector('[data-brand-wordmark="compact"]')
    expect(word).not.toBeNull()
    expect(word?.tagName).toBe('SPAN')
    expect(word?.textContent).toMatch(/Ranked\s*Gym/)
    expect(word?.querySelector('span')?.textContent).toBe('Gym')

    const line = host.querySelector('[data-brand-wordmark-line="compact"]') as HTMLElement | null
    expect(line?.className).toMatch(/text-white/)
    expect(line?.style.opacity).toBe('')
    expect(line?.style.filter).toBe('')
    expect(line?.style.transform).toBe('')
  })

  it('garde le raster PWA pour le variant hero', () => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => {
      root.render(<BrandMark variant="hero" showWordmark={false} />)
    })
    const img = host.querySelector('[data-brand-mark-image="hero"]') as HTMLImageElement | null
    expect(img?.getAttribute('src')).toBe(BRAND_MARK_HERO_SRC)
  })
})
