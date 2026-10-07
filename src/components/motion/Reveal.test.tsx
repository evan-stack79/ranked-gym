/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from './Reveal'
import {
  BlurInText,
  BLUR_WORD_STAGGER_MS,
  BLUR_IN_UP_TOTAL_MAX_MS,
  blurInUpTiming,
} from './BlurInText'
import { SoftBlurIn } from './SoftBlurIn'

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

describe('Reveal (Mask Reveal Up) / BlurInUp / SoftBlurIn', () => {
  let host: HTMLDivElement
  let root: Root
  let observe: ReturnType<typeof vi.fn>
  let disconnect: ReturnType<typeof vi.fn>
  let ioCallback: IntersectionObserverCallback | null

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    observe = vi.fn()
    disconnect = vi.fn()
    ioCallback = null

    class FakeIO {
      constructor(cb: IntersectionObserverCallback) {
        ioCallback = cb
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

  it('prefers-reduced-motion: mask reveal shows content immediately', () => {
    mockMatchMedia(true)

    act(() => {
      root.render(
        <Reveal>
          <p>Carte résumé</p>
        </Reveal>,
      )
    })

    const el = host.querySelector('[data-rg-reveal]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-rg-reveal')).toBe('in')
    expect(el.getAttribute('data-rg-reveal-variant')).toBe('mask-up')
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.className).toContain('rg-mask-reveal--instant')
    expect(observe).not.toHaveBeenCalled()
  })

  it('BlurInUp reduced-motion path settles with accessible full text', () => {
    mockMatchMedia(true)

    act(() => {
      root.render(
        <BlurInText as="h1" className="title">
          Nutrition
        </BlurInText>,
      )
    })

    const el = host.querySelector('[data-rg-blur]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-rg-blur')).toBe('settled')
    expect(el.getAttribute('data-rg-blur-variant')).toBe('up')
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.getAttribute('aria-label')).toBe('Nutrition')
    expect(el.className).toContain('rg-blur-in--settled')
    expect(el.querySelector('.sr-only')?.textContent).toBe('Nutrition')
    expect(el.querySelector('.rg-blur-words')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('BlurInUp timing keeps total ≤600ms with stagger ≤80ms', () => {
    expect(BLUR_WORD_STAGGER_MS).toBeLessThanOrEqual(80)
    const long = blurInUpTiming(8)
    expect(long.staggerMs * 7 + long.durationMs).toBeLessThanOrEqual(BLUR_IN_UP_TOTAL_MAX_MS)
    expect(long.staggerMs).toBeLessThanOrEqual(80)
  })

  it('BlurInUp splits into words and settles after last word', () => {
    act(() => {
      root.render(<BlurInText as="h1">Bonjour Alex</BlurInText>)
    })

    const el = host.querySelector('[data-rg-blur]') as HTMLElement
    expect(el.getAttribute('data-rg-blur')).toBe('pending')
    expect(el.getAttribute('aria-label')).toBe('Bonjour Alex')

    const words = el.querySelectorAll('.rg-blur-word')
    expect(words.length).toBe(2)
    expect(words[0]?.textContent).toBe('Bonjour')
    expect(words[1]?.textContent).toBe('Alex')
    expect(el.querySelector('.rg-blur-words')?.textContent).toBe('Bonjour Alex')

    const timing = blurInUpTiming(2)
    expect((words[1] as HTMLElement).style.getPropertyValue('--rg-word-delay')).toBe(
      `${timing.staggerMs}ms`,
    )

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

    expect(el.getAttribute('data-rg-blur')).toBe('in')

    act(() => {
      words[0]!.dispatchEvent(new Event('animationend', { bubbles: true }))
    })
    expect(el.getAttribute('data-rg-blur')).toBe('in')

    act(() => {
      words[1]!.dispatchEvent(new Event('animationend', { bubbles: true }))
    })

    expect(el.getAttribute('data-rg-blur')).toBe('settled')
    expect(disconnect).toHaveBeenCalled()
  })

  it('SoftBlurIn settles after animation; reduced motion is instant', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(<SoftBlurIn>Sous-titre</SoftBlurIn>)
    })
    const el = host.querySelector('[data-rg-soft-blur]') as HTMLElement
    expect(el.getAttribute('data-rg-soft-blur')).toBe('settled')
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.className).toContain('rg-soft-blur--settled')
  })

  it('Mask Reveal runs once then disconnects the observer', () => {
    act(() => {
      root.render(
        <Reveal>
          <div>card</div>
        </Reveal>,
      )
    })

    const el = host.querySelector('[data-rg-reveal]') as HTMLElement
    expect(observe).toHaveBeenCalledTimes(1)
    expect(el.className).toContain('rg-mask-reveal')

    act(() => {
      ioCallback?.(
        [
          {
            isIntersecting: true,
            target: el,
            intersectionRatio: 0.5,
            time: 0,
            boundingClientRect: el.getBoundingClientRect(),
            intersectionRect: el.getBoundingClientRect(),
            rootBounds: null,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    expect(el.getAttribute('data-rg-reveal')).toBe('in')
    expect(disconnect).toHaveBeenCalled()
  })
})
