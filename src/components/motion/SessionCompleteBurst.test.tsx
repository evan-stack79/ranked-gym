/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionCompleteBurst, SESSION_COMPLETE_BURST_MS } from './SessionCompleteBurst'

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

describe('SessionCompleteBurst', () => {
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

  it('prefers-reduced-motion: completes immediately (no UI)', () => {
    const onComplete = vi.fn()
    act(() => {
      root.render(
        <SessionCompleteBurst open onComplete={onComplete} forceReducedMotion />,
      )
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[data-rg-session-burst]')).toBeNull()
  })

  it('identical fixed celebration; skippable immediately; buttons stay clickable', () => {
    const onComplete = vi.fn()
    act(() => {
      root.render(<SessionCompleteBurst open onComplete={onComplete} />)
    })
    const burst = host.querySelector('[data-rg-session-burst]') as HTMLElement
    expect(burst).toBeTruthy()
    expect(burst.getAttribute('data-rg-anim')).toBe('session-complete')
    // No count-up / sets / kg in the fixed celebration
    expect(burst.textContent).not.toMatch(/\d+\s*(série|exercice|kg)/i)

    const skip = host.querySelector('[data-rg-session-burst-skip]') as HTMLButtonElement
    expect(skip).toBeTruthy()
    expect(getComputedStyle(skip).pointerEvents).not.toBe('none')

    act(() => {
      skip.click()
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('auto-completes after fixed ~1s', () => {
    const onComplete = vi.fn()
    act(() => {
      root.render(<SessionCompleteBurst open onComplete={onComplete} />)
    })
    act(() => {
      vi.advanceTimersByTime(SESSION_COMPLETE_BURST_MS - 1)
    })
    expect(onComplete).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
