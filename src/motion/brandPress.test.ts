/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('motion/mini', () => ({
  animate: vi.fn((_el: unknown, keyframes: unknown, opts: unknown) => ({
    keyframes,
    opts,
  })),
}))

import { animate } from 'motion/mini'
import { pressIn, pressOut } from './brandPress'

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

describe('brandPress', () => {
  beforeEach(() => {
    vi.mocked(animate).mockClear()
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pressIn scales to 0.96 in ~90ms when motion is allowed', () => {
    const el = document.createElement('button')
    pressIn(el, false)
    expect(animate).toHaveBeenCalledWith(
      el,
      { transform: 'scale(0.96)' },
      expect.objectContaining({ duration: 0.09 }),
    )
  })

  it('pressOut uses spring return when motion is allowed', () => {
    const el = document.createElement('button')
    pressOut(el, false)
    expect(animate).toHaveBeenCalledWith(
      el,
      { transform: 'scale(1)' },
      expect.objectContaining({ type: 'spring', visualDuration: 0.18 }),
    )
  })

  it('prefers-reduced-motion: no scale — opacity pulse only', () => {
    const el = document.createElement('button')
    pressIn(el, true)
    pressOut(el, true)
    expect(animate).toHaveBeenCalledWith(el, { opacity: 0.85 }, expect.any(Object))
    expect(animate).toHaveBeenCalledWith(el, { opacity: 1 }, expect.any(Object))
    const transforms = vi
      .mocked(animate)
      .mock.calls.map((c) => c[1] as Record<string, unknown>)
      .filter((k) => 'transform' in k)
    expect(transforms).toHaveLength(0)
  })
})
