/** @vitest-environment jsdom */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppColdLaunch,
  COLD_LAUNCH_LOGO_SRC,
  COLD_LAUNCH_REDUCED_MS,
  COLD_LAUNCH_TOTAL_MS,
  hasColdLaunchPlayed,
  markColdLaunchPlayed,
  resetColdLaunchGuardForTests,
} from './AppColdLaunch'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('AppColdLaunch Shockwave', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetColdLaunchGuardForTests()
    delete document.documentElement.dataset.coldLaunchPlayed
    delete document.documentElement.dataset.coldLaunchHandoff
    delete document.documentElement.dataset.coldLaunchLanding
    window.__RG_BOOT_T0__ = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetColdLaunchGuardForTests()
    delete document.documentElement.dataset.coldLaunchPlayed
    delete document.documentElement.dataset.coldLaunchHandoff
    delete document.documentElement.dataset.coldLaunchLanding
    delete window.__RG_BOOT_T0__
  })

  it('plays once on mount with logo + shockwave rings', async () => {
    const landing = vi.fn()
    window.addEventListener('ranked-gym:cold-launch-landing', landing)

    act(() => {
      root.render(
        <AppColdLaunch>
          <div data-testid="app-shell">app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })

    const splash = host.querySelector('.app-cold-launch')
    expect(splash).toBeTruthy()
    expect(splash?.getAttribute('data-shockwave')).toBe('1')
    expect(splash?.getAttribute('data-phase')).toBe('playing')
    expect(splash?.getAttribute('data-reduced')).toBe('false')
    expect(host.querySelectorAll('.app-cold-launch__ring')).toHaveLength(3)
    expect(host.querySelector('.app-cold-launch__flash')).toBeTruthy()
    const logo = host.querySelector('.app-cold-launch__mark') as HTMLImageElement
    expect(logo?.getAttribute('src')).toBe(COLD_LAUNCH_LOGO_SRC)
    expect(host.querySelector('[data-testid="app-shell"]')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(COLD_LAUNCH_TOTAL_MS)
    })

    expect(host.querySelector('.app-cold-launch')).toBeNull()
    expect(document.documentElement.dataset.coldLaunchPlayed).toBe('1')
    expect(hasColdLaunchPlayed()).toBe(true)
    expect(landing).toHaveBeenCalled()
    window.removeEventListener('ranked-gym:cold-launch-landing', landing)
  })

  it('does not replay on remount (navigation / tab change)', async () => {
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>home</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(COLD_LAUNCH_TOTAL_MS)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()

    act(() => {
      root.render(
        <AppColdLaunch>
          <div>training</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
    expect(host.textContent).toContain('training')
  })

  it('does not replay when already marked played', async () => {
    markColdLaunchPlayed()
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })

  it('tap skips the animation immediately', async () => {
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(host.querySelector('.app-cold-launch')).toBeTruthy()

    act(() => {
      host.querySelector('.app-cold-launch')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(host.querySelector('.app-cold-launch')).toBeNull()
    expect(document.documentElement.dataset.coldLaunchPlayed).toBe('1')
    expect(document.documentElement.dataset.coldLaunchLanding).toBe('1')
  })

  it('reduced motion uses a simple fade without rings or scale', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    resetColdLaunchGuardForTests()
    delete document.documentElement.dataset.coldLaunchPlayed

    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })

    const splash = host.querySelector('.app-cold-launch')
    expect(splash?.getAttribute('data-reduced')).toBe('true')
    expect(host.querySelectorAll('.app-cold-launch__ring')).toHaveLength(0)
    expect(host.querySelector('.app-cold-launch__flash')).toBeNull()
    expect(host.querySelector('.app-cold-launch__mark')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(COLD_LAUNCH_REDUCED_MS)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
    expect(document.documentElement.dataset.coldLaunchPlayed).toBe('1')
  })

  it('exits around 1s and reveals landing before removal', async () => {
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      vi.advanceTimersByTime(699)
    })
    expect(document.documentElement.dataset.coldLaunchLanding).toBeUndefined()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(document.documentElement.dataset.coldLaunchLanding).toBe('1')
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-phase')).toBe('playing')

    act(() => {
      vi.advanceTimersByTime(21)
    })
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-phase')).toBe('exiting')

    act(() => {
      vi.advanceTimersByTime(280)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })
})
