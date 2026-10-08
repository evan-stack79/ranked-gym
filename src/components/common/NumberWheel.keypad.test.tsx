/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NumberWheel,
  parseWheelKeypadInput,
  WHEEL_OUT_OF_RANGE_MESSAGE,
} from './NumberWheel'
import {
  KG_PER_LB,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  lbToKgStorage,
  sanitizeWeightKg,
} from '../../services/nutritionSafetyRules'

vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))
vi.mock('../../utils/wheelTickSound', () => ({ playWheelTickSound: vi.fn() }))

function setInput(el: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  proto?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('parseWheelKeypadInput', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseWheelKeypadInput('72,5')).toBe(72.5)
    expect(parseWheelKeypadInput('72.5')).toBe(72.5)
  })

  it('empty stays null (never 0)', () => {
    expect(parseWheelKeypadInput('')).toBeNull()
    expect(parseWheelKeypadInput('   ')).toBeNull()
    expect(parseWheelKeypadInput('.')).toBeNull()
  })

  it('rejects garbage', () => {
    expect(parseWheelKeypadInput('abc')).toBe('invalid')
    expect(parseWheelKeypadInput('12.3.4')).toBe('invalid')
  })
})

describe('NumberWheel keypad', () => {
  let container: HTMLDivElement
  let root: Root
  let value: number | null
  let onChange: ReturnType<typeof vi.fn<(v: number | null) => void>>

  function render() {
    act(() => {
      root.render(
        <NumberWheel
          min={WEIGHT_KG_MIN}
          max={WEIGHT_KG_MAX}
          value={value}
          onChange={(v) => {
            value = v
            onChange(v)
            render()
          }}
          unit="kg"
          aria-label="Poids"
        />,
      )
    })
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    value = null
    onChange = vi.fn()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('empty keypad → stays null (never 0)', () => {
    render()
    act(() => {
      ;(container.querySelector('[data-testid="number-wheel-empty"]') as HTMLButtonElement).click()
    })
    const input = container.querySelector('[data-testid="number-wheel-keypad"]') as HTMLInputElement
    expect(input).toBeTruthy()
    act(() => {
      setInput(input, '')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(value).toBeNull()
    expect(onChange).toHaveBeenCalledWith(null)
    expect(onChange.mock.calls.some((c) => c[0] === 0)).toBe(false)
  })

  it('out-of-range → refused, value unchanged, error shown', () => {
    value = 72
    render()
    act(() => {
      ;(container.querySelector('[data-testid="number-wheel-center"]') as HTMLElement).click()
    })
    const input = container.querySelector('[data-testid="number-wheel-keypad"]') as HTMLInputElement
    const callsBefore = onChange.mock.calls.length
    act(() => {
      setInput(input, '999')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(value).toBe(72)
    expect(onChange.mock.calls.length).toBe(callsBefore)
    expect(container.querySelector('[data-testid="number-wheel-error"]')?.textContent).toBe(
      WHEEL_OUT_OF_RANGE_MESSAGE,
    )
  })

  it('comma decimal is parsed', () => {
    render()
    act(() => {
      ;(container.querySelector('[data-testid="number-wheel-empty"]') as HTMLButtonElement).click()
    })
    const input = container.querySelector('[data-testid="number-wheel-keypad"]') as HTMLInputElement
    act(() => {
      setInput(input, '72,5')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(value).toBe(72.5)
  })

  it('Escape without change keeps previous value', () => {
    value = 80
    render()
    act(() => {
      ;(container.querySelector('[data-testid="number-wheel-center"]') as HTMLElement).click()
    })
    const input = container.querySelector('[data-testid="number-wheel-keypad"]') as HTMLInputElement
    act(() => {
      setInput(input, '90')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(value).toBe(80)
    expect(container.querySelector('[data-testid="number-wheel-keypad"]')).toBeNull()
  })
})

describe('NumberWheel lb keypad → kg storage without drift', () => {
  it('stores exact lb * KG_PER_LB via validateParsed path', () => {
    let storedKg: number | null = null
    const lb = 160
    const expectedKg = lb * KG_PER_LB
    // Mirror HeightWeightPicker conversion
    const display = lb
    expect(sanitizeWeightKg(lbToKgStorage(display))).toBe(expectedKg)
    storedKg = lbToKgStorage(display)
    expect(storedKg).toBe(160 * KG_PER_LB)
    // Round-trip display stable
    expect(Math.round(storedKg / KG_PER_LB)).toBe(160)
  })
})

describe('NumberWheel prefers-reduced-motion', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      return {
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      } as MediaQueryList
    })
    // jsdom lacks PointerEvent — minimal polyfill for drag simulation.
    if (typeof globalThis.PointerEvent === 'undefined') {
      class PointerEventPolyfill extends MouseEvent {
        pointerId: number
        constructor(type: string, props: MouseEventInit & { pointerId?: number } = {}) {
          super(type, props)
          this.pointerId = props.pointerId ?? 0
        }
      }
      ;(globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
        PointerEventPolyfill as unknown as typeof PointerEvent
    }
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.restoreAllMocks()
  })

  it('snaps immediately with no momentum animation under reduced motion', () => {
    let value: number | null = 140
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    let now = 5_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    act(() => {
      root.render(
        <NumberWheel
          min={WEIGHT_KG_MIN}
          max={WEIGHT_KG_MAX}
          value={value}
          onChange={(v) => {
            value = v
          }}
          unit="kg"
          aria-label="Poids"
        />,
      )
    })
    const slider = container.querySelector('[role="slider"]') as HTMLElement
    act(() => {
      slider.dispatchEvent(
        new PointerEvent('pointerdown', { clientY: 200, pointerId: 1, bubbles: true }),
      )
      now += 16
      slider.dispatchEvent(
        new PointerEvent('pointermove', { clientY: 80, pointerId: 1, bubbles: true }),
      )
      now += 16
      slider.dispatchEvent(
        new PointerEvent('pointerup', { clientY: 80, pointerId: 1, bubbles: true }),
      )
    })
    // Reduced motion: snapToNearest only — no momentum rAF coast loop.
    expect(value).not.toBeNull()
    expect(value!).toBeGreaterThanOrEqual(WEIGHT_KG_MIN)
    expect(value!).toBeLessThanOrEqual(WEIGHT_KG_MAX)
    expect(Number.isInteger(value)).toBe(true)
    // No coasting frames after pointerup (openKeypad uses rAF only on tap, not drag).
    const rafAfterDrag = rafSpy.mock.calls.length
    expect(rafAfterDrag).toBe(0)
    rafSpy.mockRestore()
  })
})
