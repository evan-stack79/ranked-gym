/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NumberWheel } from './NumberWheel'
import { HEIGHT_CM_MAX, HEIGHT_CM_MIN, WEIGHT_KG_MAX, WEIGHT_KG_MIN } from '../../services/nutritionSafetyRules'

vi.mock('../../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

vi.mock('../../utils/wheelTickSound', () => ({
  playWheelTickSound: vi.fn(),
}))

describe('NumberWheel', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
  })

  it('starts empty with — when value is null', () => {
    act(() => {
      root.render(
        <NumberWheel
          min={WEIGHT_KG_MIN}
          max={WEIGHT_KG_MAX}
          value={null}
          onChange={() => {}}
          unit="kg"
          aria-label="Poids"
        />,
      )
    })
    expect(container.querySelector('[data-testid="number-wheel-empty"]')?.textContent).toBe('—')
    const slider = container.querySelector('[role="slider"]')
    expect(slider?.getAttribute('aria-valuetext')).toBe('non renseigné')
  })

  it('exposes spinbutton/slider a11y attributes', () => {
    act(() => {
      root.render(
        <NumberWheel
          min={HEIGHT_CM_MIN}
          max={HEIGHT_CM_MAX}
          value={175}
          onChange={() => {}}
          unit="cm"
          aria-label="Taille"
        />,
      )
    })
    const slider = container.querySelector('[role="slider"]')
    expect(slider).toBeTruthy()
    expect(slider?.getAttribute('aria-valuenow')).toBe('175')
    expect(slider?.getAttribute('aria-valuemin')).toBe(String(HEIGHT_CM_MIN))
    expect(slider?.getAttribute('aria-valuemax')).toBe(String(HEIGHT_CM_MAX))
    expect(slider?.getAttribute('aria-valuetext')).toContain('175')
  })

  it('keyboard arrows change value with identical feedback path', async () => {
    const { vibrate } = await import('../../utils/haptics')
    const { playWheelTickSound } = await import('../../utils/wheelTickSound')
    let value: number | null = 70
    const onChange = (v: number | null) => {
      value = v
      act(() => {
        root.render(
          <NumberWheel
            min={WEIGHT_KG_MIN}
            max={WEIGHT_KG_MAX}
            value={value}
            onChange={onChange}
            unit="kg"
            aria-label="Poids"
          />,
        )
      })
    }

    act(() => {
      root.render(
        <NumberWheel
          min={WEIGHT_KG_MIN}
          max={WEIGHT_KG_MAX}
          value={value}
          onChange={onChange}
          unit="kg"
          aria-label="Poids"
        />,
      )
    })

    const slider = container.querySelector('[role="slider"]') as HTMLElement
    // Tick throttle is 35ms — advance performance.now between presses.
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(value).toBe(71)
    expect(vibrate).toHaveBeenCalled()
    expect(playWheelTickSound).toHaveBeenCalled()

    const callsVibrate = (vibrate as ReturnType<typeof vi.fn>).mock.calls.length
    const callsSound = (playWheelTickSound as ReturnType<typeof vi.fn>).mock.calls.length

    now += 40
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(value).toBe(72)
    // Identical feedback — same vibrate + sound for every tick (color never varies by value)
    expect((vibrate as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsVibrate + 1)
    expect((playWheelTickSound as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsSound + 1)
    expect((vibrate as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]).toBe(
      (vibrate as ReturnType<typeof vi.fn>).mock.calls.at(-2)?.[0],
    )
  })

  it('clamps to exported bounds (typo safety)', () => {
    let value: number | null = WEIGHT_KG_MIN
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
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    })
    expect(value).toBe(WEIGHT_KG_MIN)
    act(() => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })
    expect(value).toBe(WEIGHT_KG_MAX)
  })
})
