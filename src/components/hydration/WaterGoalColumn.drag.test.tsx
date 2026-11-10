/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { WaterGoalColumn, handleClientY, mlFromClientY } from './WaterGoalColumn'
import { GOAL_DEFAULT_ML, GOAL_MAX_ML, GOAL_MIN_ML } from '../../shared/hydration'

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, init?: MouseEventInit) {
      super(type, init)
    }
  }
  ;(globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent
}

describe('WaterGoalColumn drag', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => undefined
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => undefined
    }
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('touch-action none + pas de saut au premier contact + drapeau dragging', async () => {
    const onChange = vi.fn()
    const onDraggingChange = vi.fn()
    await act(async () => {
      root.render(
        <WaterGoalColumn
          valueMl={GOAL_DEFAULT_ML}
          onChange={onChange}
          onDraggingChange={onDraggingChange}
        />,
      )
    })

    const track = host.querySelector('[data-hydration-goal-slider]') as HTMLDivElement
    expect(track.style.touchAction).toBe('none')
    expect(track.className).toMatch(/touch-none/)

    const rect = {
      top: 100,
      bottom: 300,
      height: 200,
      left: 0,
      right: 96,
      width: 96,
      x: 0,
      y: 100,
      toJSON() {
        return this
      },
    } as DOMRect
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(rect)

    const startHandleY = handleClientY(GOAL_DEFAULT_ML, rect)
    await act(async () => {
      track.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientY: startHandleY,
          pointerId: 1,
        } as PointerEventInit),
      )
    })
    expect(onDraggingChange).toHaveBeenCalledWith(true)
    // Premier contact : pas d’onChange (pas de saut).
    expect(onChange).not.toHaveBeenCalled()

    const moveY = startHandleY - 40
    await act(async () => {
      track.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          button: 0,
          clientY: moveY,
          pointerId: 1,
        } as PointerEventInit),
      )
    })
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)?.[0] as number
    expect(next).toBeGreaterThan(GOAL_DEFAULT_ML)
    expect(next).toBeLessThanOrEqual(GOAL_MAX_ML)
    expect(next).toBeGreaterThanOrEqual(GOAL_MIN_ML)

    // Calcul relatif cohérent
    expect(mlFromClientY(rect.bottom, rect)).toBe(GOAL_MIN_ML)
    expect(mlFromClientY(rect.top, rect)).toBe(GOAL_MAX_ML)

    await act(async () => {
      track.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientY: moveY,
          pointerId: 1,
        } as PointerEventInit),
      )
    })
    expect(onDraggingChange).toHaveBeenCalledWith(false)
  })
})
