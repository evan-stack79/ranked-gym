/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabPageTransition } from './TabPageTransition'

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

describe('TabPageTransition', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    vi.useFakeTimers()
    mockMatchMedia(false)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('prefers-reduced-motion skips fade class', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(
        <TabPageTransition tabId="home">
          <div>Accueil</div>
        </TabPageTransition>,
      )
    })
    act(() => {
      root.render(
        <TabPageTransition tabId="nutrition">
          <div>Nutri</div>
        </TabPageTransition>,
      )
    })
    const el = host.querySelector('[data-rg-anim="tab-fade"]') as HTMLElement
    expect(el.getAttribute('data-rg-motion')).toBe('reduced')
    expect(el.classList.contains('rg-tab-fade--in')).toBe(false)
  })

  it('applies short fade on tab change when motion allowed', () => {
    act(() => {
      root.render(
        <TabPageTransition tabId="home">
          <div>A</div>
        </TabPageTransition>,
      )
    })
    act(() => {
      root.render(
        <TabPageTransition tabId="training">
          <div>B</div>
        </TabPageTransition>,
      )
    })
    const el = host.querySelector('[data-rg-anim="tab-fade"]') as HTMLElement
    expect(el.classList.contains('rg-tab-fade--crossing')).toBe(true)
    expect(host.querySelector('.rg-tab-fade--in')).toBeTruthy()
    // Outgoing stays painted under the incoming fade.
    expect(host.querySelector('.rg-tab-fade__layer--out')?.textContent).toContain('A')
    expect(host.querySelector('.rg-tab-fade__layer--in')?.textContent).toContain('B')
  })
})
