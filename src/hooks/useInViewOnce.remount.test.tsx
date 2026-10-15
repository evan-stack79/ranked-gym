/** @vitest-environment jsdom */
/**
 * Focused repro for Accueil hero Reveal stuck pending after remount.
 * Mirrors HomeGalleryView remount with coldEntering=false (instant=false).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from '../components/motion/Reveal'
import { isLayoutBoxInView, useInViewOnce } from './useInViewOnce'

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

function Probe({ instant = false }: { instant?: boolean }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ instant })
  return (
    <div
      ref={ref}
      data-probe
      data-rg-reveal={inView ? 'in' : 'pending'}
      className={inView ? 'rg-mask-reveal rg-mask-reveal--in' : 'rg-mask-reveal'}
      style={{
        width: 200,
        height: 280,
        clipPath: inView ? 'inset(0)' : 'inset(100% 0 0 0)',
      }}
    >
      Séance du jour
    </div>
  )
}

describe('useInViewOnce / Reveal remount (coldEntering=false path)', () => {
  let host: HTMLDivElement
  let root: Root
  let observe: ReturnType<typeof vi.fn>
  let disconnect: ReturnType<typeof vi.fn>
  let ioCallback: IntersectionObserverCallback | null
  let lastOptions: IntersectionObserverInit | undefined

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    observe = vi.fn()
    disconnect = vi.fn()
    ioCallback = null
    lastOptions = undefined
    delete document.documentElement.dataset.coldLaunchLanding

    class FakeIO {
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        ioCallback = cb
        lastOptions = options
      }
      observe = observe
      unobserve = vi.fn()
      disconnect = disconnect
      takeRecords = () => []
      root = null
      rootMargin = ''
      thresholds = []
    }
    vi.stubGlobal('IntersectionObserver', FakeIO)
    mockMatchMedia(false)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('first mount with instant=true (cold launch) is immediately in', () => {
    act(() => {
      root.render(
        <Reveal instant>
          <button type="button" data-accueil-hero="session">
            card
          </button>
        </Reveal>,
      )
    })
    const el = host.querySelector('[data-rg-reveal]') as HTMLElement
    expect(el.getAttribute('data-rg-reveal')).toBe('in')
    expect(observe).not.toHaveBeenCalled()
  })

  it('remount with instant=false stays pending until IO fires (jsdom never auto-fires)', () => {
    // Simulate cold launch first paint
    act(() => {
      root.render(
        <Reveal instant>
          <button type="button" data-accueil-hero="session">
            Séance
          </button>
        </Reveal>,
      )
    })
    expect(host.querySelector('[data-rg-reveal]')?.getAttribute('data-rg-reveal')).toBe('in')

    // Unmount (leave Accueil → Train)
    act(() => {
      root.render(<div data-training>Train</div>)
    })
    expect(host.querySelector('[data-accueil-hero]')).toBeNull()

    // Remount Accueil without coldEntering (instant=false) — production remount path
    act(() => {
      root.render(
        <Reveal>
          <button type="button" data-accueil-hero="session">
            Séance
          </button>
        </Reveal>,
      )
    })

    const el = host.querySelector('[data-rg-reveal]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-rg-reveal')).toBe('pending')
    expect(el.querySelector('.rg-mask-reveal')).not.toBeNull()
    expect(el.querySelector('.rg-mask-reveal--in')).toBeNull()
    expect(observe).toHaveBeenCalled()
    expect(lastOptions?.rootMargin).toBe('0px 0px -6% 0px')
    expect(lastOptions?.threshold).toBe(0.12)

    // Without callback, hero stays clipped — this is the stuck state the bug describes.
    // Real browsers should fire IO if the target intersects; if clip-path zeros intersection,
    // they stay pending forever (verified in Playwright repro).
  })

  it('Probe: if IO reports not intersecting (clip-path zero), stays pending', () => {
    act(() => {
      root.render(<Probe />)
    })
    const el = host.querySelector('[data-probe]') as HTMLElement
    expect(el.getAttribute('data-rg-reveal')).toBe('pending')

    act(() => {
      ioCallback?.(
        [
          {
            isIntersecting: false,
            intersectionRatio: 0,
            target: el,
            time: 0,
            boundingClientRect: el.getBoundingClientRect(),
            intersectionRect: new DOMRect(0, 0, 0, 0),
            rootBounds: null,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    expect(el.getAttribute('data-rg-reveal')).toBe('pending')
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('isLayoutBoxInView ignores paint clipping and uses border box', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 40,
      bottom: 340,
      left: 16,
      right: 216,
      width: 200,
      height: 300,
      x: 16,
      y: 40,
      toJSON() {
        return {}
      },
    })
    expect(isLayoutBoxInView(el)).toBe(true)
    el.remove()
  })

  it('rAF layout fallback marks in when IO reports ratio 0 but box is on-screen', async () => {
    const rect = {
      top: 40,
      bottom: 340,
      left: 16,
      right: 216,
      width: 200,
      height: 300,
      x: 16,
      y: 40,
      toJSON() {
        return {}
      },
    }
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(rect as DOMRect)

    act(() => {
      root.render(<Probe />)
    })

    // IO may fire ratio 0 (clip-path); layout fallback should still win after paint.
    act(() => {
      const el = host.querySelector('[data-probe]') as HTMLElement
      ioCallback?.(
        [
          {
            isIntersecting: false,
            intersectionRatio: 0,
            target: el,
            time: 0,
            boundingClientRect: rect as DOMRect,
            intersectionRect: new DOMRect(0, 0, 0, 0),
            rootBounds: null,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })

    const el = host.querySelector('[data-probe]') as HTMLElement
    expect(el.getAttribute('data-rg-reveal')).toBe('in')
    expect(disconnect).toHaveBeenCalled()
    spy.mockRestore()
  })
})
