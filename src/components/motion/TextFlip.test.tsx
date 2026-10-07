/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GREETING_FLIP_WORDS, TextFlip, TEXT_FLIP_INTERVAL_MS } from './TextFlip'

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

describe('TextFlip', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    mockMatchMedia(false)
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('defaults to Prêt / Motivé / Focus and exposes static sr-only Prêt', () => {
    expect([...GREETING_FLIP_WORDS]).toEqual(['Prêt', 'Motivé', 'Focus'])
    expect(TEXT_FLIP_INTERVAL_MS).toBe(2500)

    act(() => {
      root.render(<TextFlip />)
    })

    const el = host.querySelector('[data-rg-text-flip]') as HTMLElement
    expect(el.querySelector('.sr-only')?.textContent).toBe('Prêt')
    expect(el.querySelector('[aria-hidden="true"] .rg-text-flip__word')?.textContent).toBe('Prêt')
    expect(el.querySelector('[aria-live]')).toBeNull()
  })

  it('prefers-reduced-motion shows only Prêt (no cycle)', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(<TextFlip />)
    })
    const el = host.querySelector('[data-rg-text-flip="static"]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.textContent).toBe('Prêt')
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
  })

  it('cycles to the next word after interval and pauses when tab hidden', () => {
    act(() => {
      root.render(<TextFlip />)
    })

    act(() => {
      vi.advanceTimersByTime(TEXT_FLIP_INTERVAL_MS + 50)
    })
    expect(host.querySelector('.rg-text-flip__word--out')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    const word = host.querySelector('.rg-text-flip__word')?.textContent
    expect(word).toBe('Motivé')

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(TEXT_FLIP_INTERVAL_MS * 3)
    })
    // Still Motivé — cycle paused while hidden
    expect(host.querySelector('.rg-text-flip__word')?.textContent).toBe('Motivé')
  })
})
