/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('motion/mini', () => ({
  animate: vi.fn(() => Promise.resolve()),
}))

import { BravoShine } from './BravoShine'

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

describe('BravoShine', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    mockMatchMedia(false)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('shows Bravo without any kcal copy', () => {
    act(() => {
      root.render(
        <BravoShine
          stats={{ title: 'Push', durationMin: 52, volumeKg: 4200, prCount: 0 }}
          onContinue={() => undefined}
        />,
      )
    })
    const text = host.textContent ?? ''
    expect(text).toMatch(/Bravo/)
    expect(text.toLowerCase()).not.toMatch(/kcal|calorie|il te reste/)
    expect(host.querySelector('[data-rg-bravo-shine]')).toBeTruthy()
  })

  it('prefers-reduced-motion: marks reduced and still shows Bravo', () => {
    act(() => {
      root.render(
        <BravoShine
          forceReducedMotion
          stats={{ title: 'Push', durationMin: 40, volumeKg: 3000, prCount: 1 }}
          onContinue={() => undefined}
        />,
      )
    })
    const rootEl = host.querySelector('[data-rg-bravo-shine]') as HTMLElement
    expect(rootEl.getAttribute('data-rg-motion')).toBe('reduced')
    expect(host.textContent).toMatch(/Bravo/)
  })
})
