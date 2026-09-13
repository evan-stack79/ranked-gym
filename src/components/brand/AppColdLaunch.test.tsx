/** @vitest-environment jsdom */
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppColdLaunch,
  COLD_LAUNCH_CALM_SRC,
  COLD_LAUNCH_MAX_MS,
  COLD_LAUNCH_MIN_MS,
  COLD_LAUNCH_ROAR_SRC,
  coldLaunchDeadlineMs,
} from './AppColdLaunch'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('AppColdLaunch', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    delete document.documentElement.dataset.coldLaunchPlayed
    window.__RG_BOOT_T0__ = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(performance, 'now').mockReturnValue(50)
    // Images préchargées : décodage immédiat réussi
    vi.stubGlobal(
      'Image',
      class MockImage {
        complete = true
        naturalWidth = 180
        decoding = 'async'
        src = ''
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null
        onerror: OnErrorEventHandler = null
        decode() {
          return Promise.resolve()
        }
      },
    )
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
    delete document.documentElement.dataset.coldLaunchPlayed
    delete window.__RG_BOOT_T0__
  })

  it('échéance document entre 0,8 et 1,2 s', () => {
    window.__RG_BOOT_T0__ = 0
    const d = coldLaunchDeadlineMs(50)
    expect(d.totalMs).toBeGreaterThanOrEqual(COLD_LAUNCH_MIN_MS)
    expect(d.totalMs).toBeLessThanOrEqual(COLD_LAUNCH_MAX_MS)
    expect(d.doneAt).toBeGreaterThan(d.roarAt)
    expect(d.exitAt).toBeLessThan(d.doneAt)
  })

  it('affiche calme puis rugissant puis disparaît (cold start)', async () => {
    act(() => {
      root.render(
        <StrictMode>
          <AppColdLaunch>
            <div>app</div>
          </AppColdLaunch>
        </StrictMode>,
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    const splash = () => host.querySelector('.app-cold-launch')
    expect(splash()?.getAttribute('data-phase')).toBe('calm')
    const imgs = host.querySelectorAll('.app-cold-launch__mark') as NodeListOf<HTMLImageElement>
    expect(imgs).toHaveLength(2)
    expect(imgs[0].getAttribute('src')).toBe(COLD_LAUNCH_CALM_SRC)
    expect(imgs[1].getAttribute('src')).toBe(COLD_LAUNCH_ROAR_SRC)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('roar')
    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('exiting')
    act(() => {
      vi.advanceTimersByTime(540)
    })
    expect(splash()).toBeNull()
    expect(document.documentElement.dataset.coldLaunchPlayed).toBe('1')
  })

  it('garde calm si roar non décodé (échec / lenteur)', async () => {
    vi.stubGlobal(
      'Image',
      class MockImageFailRoar {
        decoding = 'async'
        onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null
        onerror: OnErrorEventHandler = null
        private _src = ''
        get src() {
          return this._src
        }
        set src(v: string) {
          this._src = v
        }
        get complete() {
          return this._src.includes('calm')
        }
        get naturalWidth() {
          return this._src.includes('calm') ? 180 : 0
        }
        decode() {
          return this._src.includes('calm')
            ? Promise.resolve()
            : Promise.reject(new Error('roar fail'))
        }
      },
    )

    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-phase')).toBe('calm')
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })

  it('ne rejoue pas si déjà marqué (pas de replay arrière-plan)', () => {
    document.documentElement.dataset.coldLaunchPlayed = '1'
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })

  it('reduced-motion : fermeture rapide sans animation longue', () => {
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
    delete document.documentElement.dataset.coldLaunchPlayed
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-reduced')).toBe('true')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })

  it('visibilitychange seul ne relance pas le splash', () => {
    act(() => {
      root.render(
        <AppColdLaunch>
          <div>app</div>
        </AppColdLaunch>,
      )
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })
})
