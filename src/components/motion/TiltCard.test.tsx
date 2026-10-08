/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TiltCard,
  computeTiltVars,
  TILT_MAX_DEG,
  TILT_SWIPE_CANCEL_PX,
} from './TiltCard'

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

class TestPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string
  constructor(
    type: string,
    params: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
  ) {
    super(type, { bubbles: true, cancelable: true, ...params })
    this.pointerId = params.pointerId ?? 1
    this.pointerType = params.pointerType ?? 'mouse'
  }
}

function stubPlaneRect(plane: HTMLElement) {
  vi.spyOn(plane, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 300,
    width: 200,
    height: 300,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('TiltCard', () => {
  let host: HTMLDivElement
  let root: Root
  let rafQueue: FrameRequestCallback[]

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    mockMatchMedia(false)
    vi.stubGlobal('PointerEvent', TestPointerEvent)

    rafQueue = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        rafQueue.push(cb)
        return rafQueue.length
      },
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafQueue[id - 1] = () => {}
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function flushRaf() {
    const queue = [...rafQueue]
    rafQueue.length = 0
    for (const cb of queue) cb(performance.now())
  }

  function renderTilt(onClick?: () => void) {
    act(() => {
      root.render(
        <div data-accueil-carousel style={{ overflowX: 'auto' }}>
          <TiltCard>
            <button type="button" onClick={onClick} data-tilt-target>
              Carte
            </button>
          </TiltCard>
        </div>,
      )
    })
    const rootEl = host.querySelector('[data-rg-tilt]') as HTMLElement
    const plane = host.querySelector('[data-rg-tilt-plane]') as HTMLElement
    expect(rootEl).not.toBeNull()
    if (plane) stubPlaneRect(plane)
    return { rootEl, plane }
  }

  it('computeTiltVars maps center to flat and corners within max deg', () => {
    const rect = { left: 0, top: 0, width: 200, height: 200 }
    const mid = computeTiltVars(100, 100, rect)
    expect(mid.rx).toBeCloseTo(0, 5)
    expect(mid.ry).toBeCloseTo(0, 5)
    expect(mid.gx).toBeCloseTo(50, 5)
    expect(mid.gy).toBeCloseTo(50, 5)

    const corner = computeTiltVars(200, 0, rect)
    expect(corner.ry).toBeCloseTo(TILT_MAX_DEG, 5)
    expect(corner.rx).toBeCloseTo(TILT_MAX_DEG, 5)
    expect(Math.abs(corner.rx)).toBeLessThanOrEqual(8)
    expect(Math.abs(corner.ry)).toBeLessThanOrEqual(8)
  })

  it('sets tilt CSS vars on pointer move and resets on pointerup', () => {
    const { rootEl, plane } = renderTilt()
    expect(plane).not.toBeNull()

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerdown', {
          clientX: 100,
          clientY: 80,
          pointerType: 'touch',
        }),
      )
      // Stay under the horizontal swipe threshold so tilt stays active.
      rootEl.dispatchEvent(
        new TestPointerEvent('pointermove', {
          clientX: 108,
          clientY: 220,
          pointerType: 'touch',
        }),
      )
      flushRaf()
    })

    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('1')
    expect(rootEl.classList.contains('rg-tilt--active')).toBe(true)
    const rx = plane!.style.getPropertyValue('--rx')
    const ry = plane!.style.getPropertyValue('--ry')
    const gx = plane!.style.getPropertyValue('--gx')
    const gy = plane!.style.getPropertyValue('--gy')
    expect(rx).not.toBe('0deg')
    expect(ry).not.toBe('0deg')
    expect(gx).not.toBe('50%')
    expect(gy).not.toBe('50%')
    expect(host.querySelector('[data-rg-tilt-glare]')).not.toBeNull()

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerup', {
          clientX: 108,
          clientY: 220,
          pointerType: 'touch',
        }),
      )
    })

    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('0')
    expect(plane!.style.getPropertyValue('--rx')).toBe('0deg')
    expect(plane!.style.getPropertyValue('--ry')).toBe('0deg')
    expect(plane!.style.getPropertyValue('--gx')).toBe('50%')
    expect(plane!.style.getPropertyValue('--gy')).toBe('50%')
    expect(plane!.style.getPropertyValue('--tilt-scale')).toBe('1')
  })

  it('resets on pointercancel', () => {
    const { rootEl, plane } = renderTilt()

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        }),
      )
      flushRaf()
    })
    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('1')

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointercancel', {
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        }),
      )
    })

    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('0')
    expect(plane!.style.getPropertyValue('--rx')).toBe('0deg')
  })

  it('horizontal swipe cancels the tilt', () => {
    const { rootEl, plane } = renderTilt()

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerdown', {
          clientX: 40,
          clientY: 150,
          pointerType: 'touch',
        }),
      )
      flushRaf()
    })
    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('1')

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointermove', {
          clientX: 40 + TILT_SWIPE_CANCEL_PX + 4,
          clientY: 152,
          pointerType: 'touch',
        }),
      )
      flushRaf()
    })

    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('0')
    expect(plane!.style.getPropertyValue('--rx')).toBe('0deg')
    expect(plane!.style.getPropertyValue('--ry')).toBe('0deg')
  })

  it('carousel scroll cancels an active tilt', () => {
    const { rootEl, plane } = renderTilt()
    const scroller = host.querySelector('[data-accueil-carousel]') as HTMLElement

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerdown', {
          clientX: 100,
          clientY: 120,
          pointerType: 'touch',
        }),
      )
      flushRaf()
    })
    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('1')

    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    expect(rootEl.getAttribute('data-rg-tilt-active')).toBe('0')
    expect(plane!.style.getPropertyValue('--rx')).toBe('0deg')
  })

  it('click still fires on the inner card button', () => {
    const onClick = vi.fn()
    const { rootEl } = renderTilt(onClick)
    const button = host.querySelector('[data-tilt-target]') as HTMLButtonElement

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        }),
      )
      flushRaf()
      rootEl.dispatchEvent(
        new TestPointerEvent('pointerup', {
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        }),
      )
      button.click()
    })

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('prefers-reduced-motion disables tilt and glare', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(
        <TiltCard>
          <button type="button">Carte</button>
        </TiltCard>,
      )
    })

    const rootEl = host.querySelector('[data-rg-tilt]') as HTMLElement
    expect(rootEl.getAttribute('data-rg-tilt')).toBe('off')
    expect(host.querySelector('[data-rg-tilt-glare]')).toBeNull()
    expect(host.querySelector('[data-rg-tilt-plane]')).toBeNull()

    act(() => {
      rootEl.dispatchEvent(
        new TestPointerEvent('pointermove', {
          clientX: 160,
          clientY: 80,
          pointerType: 'mouse',
        }),
      )
      flushRaf()
    })

    expect(rootEl.classList.contains('rg-tilt--active')).toBe(false)
  })
})
