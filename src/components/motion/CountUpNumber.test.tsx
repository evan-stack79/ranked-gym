/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CountUpNumber, COUNT_UP_ALLOWED_KINDS } from './CountUpNumber'

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

describe('CountUpNumber', () => {
  let host: HTMLDivElement
  let root: Root
  let ioCallback: IntersectionObserverCallback | null

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    ioCallback = null
    class FakeIO {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = () => []
      root = null
      rootMargin = ''
      thresholds = []
    }
    vi.stubGlobal('IntersectionObserver', FakeIO)
    mockMatchMedia(false)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(performance.now() + 500), 0) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('allowlist is water / sessions / successful_sets only', () => {
    expect([...COUNT_UP_ALLOWED_KINDS].sort()).toEqual([
      'sessions',
      'successful_sets',
      'water',
    ])
    expect(COUNT_UP_ALLOWED_KINDS).not.toContain('kcal')
    expect(COUNT_UP_ALLOWED_KINDS).not.toContain('body_weight')
  })

  it('prefers-reduced-motion: shows final value immediately', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(<CountUpNumber kind="sessions" value={12} />)
    })
    const el = host.querySelector('[data-rg-count="sessions"]') as HTMLElement
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.textContent).toBe('12')
  })

  it('counts up after entering viewport', async () => {
    act(() => {
      root.render(<CountUpNumber kind="water" value={900} />)
    })
    const el = host.querySelector('[data-rg-count="water"]') as HTMLElement
    expect(el.textContent).toBe('0')

    act(() => {
      ioCallback?.(
        [
          {
            isIntersecting: true,
            target: el,
            intersectionRatio: 1,
            time: 0,
            boundingClientRect: el.getBoundingClientRect(),
            intersectionRect: el.getBoundingClientRect(),
            rootBounds: null,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(el.textContent).toBe('900')
  })
})
