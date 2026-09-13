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
  ROAR_BREATH_MIN_MS,
  coldLaunchDeadlineMs,
  computeColdLaunchPhaseDelays,
  computeUniformPantherFlight,
  isFlyerPantherVisible,
  isHeaderPantherVisible,
} from './AppColdLaunch'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

describe('AppColdLaunch', () => {
  let host: HTMLDivElement
  let root: Root
  let target: HTMLDivElement

  beforeEach(() => {
    delete document.documentElement.dataset.coldLaunchPlayed
    delete document.documentElement.dataset.coldLaunchHandoff
    delete document.documentElement.dataset.coldLaunchLanding
    delete document.documentElement.dataset.coldLaunchHeaderWordmark
    window.__RG_BOOT_T0__ = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(performance, 'now').mockReturnValue(50)
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

    target = document.createElement('div')
    target.innerHTML =
      '<div data-cold-launch-target="compact"><img data-brand-mark-image="compact" alt="" /></div>'
    document.body.appendChild(target)

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    target.remove()
    host.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete document.documentElement.dataset.coldLaunchPlayed
    delete document.documentElement.dataset.coldLaunchHandoff
    delete document.documentElement.dataset.coldLaunchLanding
    delete document.documentElement.dataset.coldLaunchHeaderWordmark
    delete window.__RG_BOOT_T0__
  })

  it('document deadline stays between 1.3 and 1.5s with mid-travel reveal', () => {
    window.__RG_BOOT_T0__ = 0
    const d = coldLaunchDeadlineMs(50)
    expect(d.totalMs).toBeGreaterThanOrEqual(1300)
    expect(d.totalMs).toBeLessThanOrEqual(1500)
    expect(d.totalMs).toBeGreaterThanOrEqual(COLD_LAUNCH_MIN_MS)
    expect(d.totalMs).toBeLessThanOrEqual(COLD_LAUNCH_MAX_MS)
    expect(d.doneAt).toBeGreaterThanOrEqual(1300)
    expect(d.doneAt).toBeLessThanOrEqual(1500)
    expect(d.flipStartAt).toBeGreaterThanOrEqual(350)
    expect(d.flipStartAt).toBeLessThanOrEqual(500)
    const travelMs = d.handoffAt - d.flipStartAt
    expect(travelMs).toBeGreaterThanOrEqual(450)
    expect(travelMs).toBeLessThanOrEqual(550)
    expect(d.revealAt).toBeGreaterThan(d.flipStartAt)
    expect(d.revealAt).toBeLessThan(d.handoffAt)
    expect(d.doneAt).toBeGreaterThan(d.handoffAt)
    expect(d.handoffAt).toBeGreaterThan(d.morphAt)
    expect(d.revealAt).toBeGreaterThan(d.roarAt)
  })

  it('keeps roar→morph hold >= 250ms when mounted after roarAt', () => {
    window.__RG_BOOT_T0__ = 0
    const onTime = coldLaunchDeadlineMs(50)
    expect(onTime.morphAt - onTime.roarAt).toBe(ROAR_BREATH_MIN_MS)

    const previousRoarHoldMs = (now: number) => {
      const d = coldLaunchDeadlineMs(now)
      const roarDelay = Math.max(0, d.roarAt - now)
      const morphDelay = Math.max(roarDelay + 40, d.morphAt - now)
      return morphDelay - roarDelay
    }

    for (const now of [200, 287, 400, 428]) {
      const d = coldLaunchDeadlineMs(now)
      expect(now).toBeGreaterThan(d.roarAt)
      const delays = computeColdLaunchPhaseDelays(now, d)
      expect(delays.roarDelay).toBe(0)
      expect(delays.roarToMorphHoldMs).toBeGreaterThanOrEqual(250)
      expect(delays.roarToMorphHoldMs).toBe(ROAR_BREATH_MIN_MS)
      expect(delays.morphDelay - delays.roarDelay).toBeGreaterThanOrEqual(250)
    }

    // Lag probe: the old +40 floor collapsed breath into the 32–173ms band.
    expect(previousRoarHoldMs(287)).toBe(173)
    expect(previousRoarHoldMs(400)).toBe(60)
    expect(previousRoarHoldMs(428)).toBe(40)

    const moderateLag = computeColdLaunchPhaseDelays(400)
    expect(moderateLag.elapsedFromOriginAtDone).toBeLessThanOrEqual(COLD_LAUNCH_MAX_MS)

    const severeLag = computeColdLaunchPhaseDelays(800)
    expect(severeLag.roarToMorphHoldMs).toBeGreaterThanOrEqual(250)
    expect(severeLag.elapsedFromOriginAtDone).toBeGreaterThan(COLD_LAUNCH_MAX_MS)
  })

  it('schedules roar→morph hold >= 250ms after a late React mount', async () => {
    window.__RG_BOOT_T0__ = 0
    vi.spyOn(performance, 'now').mockReturnValue(400)

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

    const splash = () => host.querySelector('.app-cold-launch')
    expect(splash()?.getAttribute('data-phase')).toBe('roar')

    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('roar')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(splash()?.getAttribute('data-phase')).not.toBe('morphing')

    act(() => {
      vi.advanceTimersByTime(30)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('morphing')
  })

  it('uses only uniform scale for the flying panther', async () => {
    const flyerRect = makeRect(110, 460, 132, 132)
    const targetRect = makeRect(18, 72, 38, 38)
    const flyerAnimate = vi.fn()

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

    const flyer = host.querySelector('[data-cold-launch-panther-flyer]') as HTMLDivElement
    const compact = target.querySelector('[data-brand-mark-image="compact"]') as HTMLImageElement
    flyer.getBoundingClientRect = () => flyerRect
    compact.getBoundingClientRect = () => targetRect
    ;(flyer as HTMLDivElement & { animate: typeof flyerAnimate }).animate = flyerAnimate.mockReturnValue({
      cancel: vi.fn(),
    } as unknown as Animation)

    act(() => {
      vi.advanceTimersByTime(620)
    })

    expect(flyerAnimate).toHaveBeenCalledOnce()
    const keyframes = flyerAnimate.mock.calls[0]?.[0] as Array<{ transform: string }>
    expect(keyframes[1]?.transform).toMatch(/scale\([0-9.]+\)$/)
    expect(keyframes[1]?.transform).not.toMatch(/scale\([^)]*,/)
  })

  it('keeps panther aspect ratio stable within 1% at 320/375/390 targets', () => {
    const widths = [320, 375, 390]
    for (const screenWidth of widths) {
      const start = makeRect((screenWidth - 132) / 2, 500, 132, 132)
      const end = makeRect(16, 72, 38, 38)
      const flight = computeUniformPantherFlight(start, end)
      const w = start.width * flight.scale
      const h = start.height * flight.scale
      const ratioBefore = start.width / start.height
      const ratioAfter = w / h
      const drift = Math.abs(ratioAfter - ratioBefore) / ratioBefore
      expect(drift).toBeLessThanOrEqual(0.01)
    }
  })

  it('matches final panther center with no jump at handoff', () => {
    const start = makeRect(129, 504, 132, 132)
    const end = makeRect(18, 72, 38, 38)
    const flight = computeUniformPantherFlight(start, end)
    const endScaleSize = start.width * flight.scale
    const finalLeft = start.left + (start.width - endScaleSize) / 2 + flight.moveX
    const finalTop = start.top + (start.height - endScaleSize) / 2 + flight.moveY
    const finalCx = finalLeft + endScaleSize / 2
    const finalCy = finalTop + endScaleSize / 2
    const targetCx = end.left + end.width / 2
    const targetCy = end.top + end.height / 2
    expect(Math.abs(finalCx - targetCx)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(finalCy - targetCy)).toBeLessThanOrEqual(0.5)
  })

  it('never allows two visible panthers at handoff', () => {
    expect(isFlyerPantherVisible('handoff')).toBe(false)
    expect(isHeaderPantherVisible('done', undefined)).toBe(true)
    expect(isHeaderPantherVisible(undefined, '1')).toBe(true)
  })

  it('runs calm → roar → morphing and switches visibility at handoff', async () => {
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

    const splash = () => host.querySelector('.app-cold-launch')
    expect(splash()?.getAttribute('data-phase')).toBe('calm')
    const imgs = host.querySelectorAll('.app-cold-launch__mark') as NodeListOf<HTMLImageElement>
    expect(imgs).toHaveLength(2)
    expect(imgs[0].getAttribute('src')).toBe(COLD_LAUNCH_CALM_SRC)
    expect(imgs[1].getAttribute('src')).toBe(COLD_LAUNCH_ROAR_SRC)
    const animateStub = vi.fn().mockReturnValue({ cancel: vi.fn() } as unknown as Animation)
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: animateStub,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const el = this
      if (el.matches('[data-cold-launch-panther-flyer]')) {
        return makeRect(129, 504, 132, 132)
      }
      if (el.matches('[data-brand-mark-image="compact"]')) {
        return makeRect(18, 72, 38, 38)
      }
      return makeRect(0, 0, 0, 0)
    })
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('roar')

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(splash()?.getAttribute('data-phase')).toBe('morphing')

    const centerWordmark = host.querySelector('.app-cold-launch__wordmark')
    act(() => {
      vi.advanceTimersByTime(40)
    })
    expect(centerWordmark?.getAttribute('data-visible')).toBe('false')
    expect(document.documentElement.dataset.coldLaunchHeaderWordmark).toBe('0')

    act(() => {
      vi.advanceTimersByTime(240)
    })
    expect(document.documentElement.dataset.coldLaunchHeaderWordmark).toBe('1')

    act(() => {
      vi.advanceTimersByTime(560)
    })
    expect(splash()).toBeNull()
    expect(document.documentElement.dataset.coldLaunchPlayed).toBe('1')
  })

  it('keeps calm visual when roar decoding fails', async () => {
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
      vi.advanceTimersByTime(580)
    })
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-phase')).toBe('morphing')
    expect(host.querySelector('.app-cold-launch__mark--calm')?.getAttribute('data-active')).toBe('true')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
  })

  it('does not replay when already marked played', async () => {
    document.documentElement.dataset.coldLaunchPlayed = '1'
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

  it('reduced-motion closes quickly without long travel', async () => {
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
    await act(async () => {
      await Promise.resolve()
    })
    expect(host.querySelector('.app-cold-launch')?.getAttribute('data-reduced')).toBe('true')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(host.querySelector('.app-cold-launch')).toBeNull()
    expect(document.documentElement.dataset.coldLaunchLanding).toBeUndefined()
  })
})
