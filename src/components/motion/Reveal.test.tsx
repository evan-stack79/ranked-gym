/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from './Reveal'
import { BlurInText, BLUR_WORD_STAGGER_MS } from './BlurInText'

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

describe('Reveal / BlurInText', () => {
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

  it('prefers-reduced-motion: shows content immediately without pending state', () => {
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
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.className).toContain('rg-reveal--instant')
    expect(observe).not.toHaveBeenCalled()
  })

  it('BlurInText reduced-motion path settles with accessible full text', () => {
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
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.getAttribute('aria-label')).toBe('Nutrition')
    expect(el.className).toContain('rg-blur-in--settled')
    expect(el.querySelector('.sr-only')?.textContent).toBe('Nutrition')
    expect(el.querySelector('.rg-blur-words')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('BlurInText splits into words with stagger ≤80ms and settles after last word', () => {
    expect(BLUR_WORD_STAGGER_MS).toBeLessThanOrEqual(80)

    act(() => {
      root.render(<BlurInText as="h1">Bonjour Alex</BlurInText>)
    })

    const el = host.querySelector('[data-rg-blur]') as HTMLElement
    expect(el.getAttribute('data-rg-blur')).toBe('pending')
    expect(el.getAttribute('aria-label')).toBe('Bonjour Alex')

    const words = el.querySelectorAll('.rg-blur-word')
    expect(words.length).toBe(2)
    expect(words[0]?.textContent?.trim()).toBe('Bonjour')
    expect(words[1]?.textContent?.trim()).toBe('Alex')
    expect((words[1] as HTMLElement).style.getPropertyValue('--rg-word-delay')).toBe(
      `${BLUR_WORD_STAGGER_MS}ms`,
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
    expect(el.className).toContain('rg-blur-in--in')

    act(() => {
      words[0]!.dispatchEvent(new Event('animationend', { bubbles: true }))
    })
    expect(el.getAttribute('data-rg-blur')).toBe('in')

    act(() => {
      words[1]!.dispatchEvent(new Event('animationend', { bubbles: true }))
    })

    expect(el.getAttribute('data-rg-blur')).toBe('settled')
    expect(el.className).toContain('rg-blur-in--settled')
    expect(disconnect).toHaveBeenCalled()
  })

  it('Reveal runs once then disconnects the observer', () => {
    act(() => {
      root.render(
        <Reveal>
          <div>card</div>
        </Reveal>,
      )
    })

    const el = host.querySelector('[data-rg-reveal]') as HTMLElement
    expect(observe).toHaveBeenCalledTimes(1)

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
