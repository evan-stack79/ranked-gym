/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveBottleVisual } from './LiveBottleVisual'

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && String(query).includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('LiveBottleVisual wave undulation', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(performance.now()), 0) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('prefers-reduced-motion: never mounts wave layers', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(
        <LiveBottleVisual
          kind="plastic_15"
          remainingMl={1200}
          capacityMl={1500}
          interactive
          showHandle
        />,
      )
    })
    expect(host.querySelector('[data-hydration-wave]')).toBeNull()
  })

  it('water level still follows remainingMl under reduced-motion', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(
        <LiveBottleVisual kind="plastic_15" remainingMl={900} capacityMl={1500} showHandle />,
      )
    })
    const fill = host.querySelector('[data-hydration-water-fill]') as HTMLElement
    expect(fill.style.height).toMatch(/%/)
    expect(Number.parseFloat(fill.style.height)).toBeGreaterThan(0)
  })
})
