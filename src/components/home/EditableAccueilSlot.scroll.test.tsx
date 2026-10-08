/** @vitest-environment jsdom */
/**
 * Outside edit mode, Accueil slots must never steal vertical scroll:
 * no setPointerCapture, no preventDefault, long-press cancels on move > threshold.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCUEIL_LONG_PRESS_MOVE_PX, ACCUEIL_LONG_PRESS_MS } from '../../utils/accueilEditGestures'
import { EditableAccueilSlot } from './EditableAccueilSlot'

describe('EditableAccueilSlot scroll safety (outside edit)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    HTMLElement.prototype.setPointerCapture ??= function setPointerCapture() {}
    HTMLElement.prototype.releasePointerCapture ??= function releasePointerCapture() {}
    if (typeof globalThis.PointerEvent === 'undefined') {
      class FakePointerEvent extends MouseEvent {
        pointerId: number
        pointerType: string
        isPrimary: boolean
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init)
          this.pointerId = init.pointerId ?? 1
          this.pointerType = init.pointerType ?? 'touch'
          this.isPrimary = init.isPrimary ?? true
        }
      }
      // @ts-expect-error jsdom polyfill
      globalThis.PointerEvent = FakePointerEvent
    }
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('does not setPointerCapture or preventDefault outside edit mode', async () => {
    const onEnterEdit = vi.fn()
    const captureSpy = vi.spyOn(HTMLElement.prototype, 'setPointerCapture')

    await act(async () => {
      root.render(
        <EditableAccueilSlot
          id="eau"
          editMode={false}
          reducedMotion
          dragging={false}
          onEnterEdit={onEnterEdit}
          onHide={() => {}}
          onDragStart={() => {}}
          onDragMove={() => {}}
          onDragEnd={() => {}}
        >
          <div>Eau</div>
        </EditableAccueilSlot>,
      )
    })

    const slot = host.querySelector('[data-accueil-edit-slot="eau"]') as HTMLElement
    expect(slot).toBeTruthy()

    const down = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40,
      button: 0,
    })
    const preventSpy = vi.spyOn(down, 'preventDefault')
    act(() => {
      slot.dispatchEvent(down)
    })
    expect(captureSpy).not.toHaveBeenCalled()
    expect(preventSpy).not.toHaveBeenCalled()

    const move = new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40 + ACCUEIL_LONG_PRESS_MOVE_PX + 4,
      button: 0,
    })
    const movePrevent = vi.spyOn(move, 'preventDefault')
    act(() => {
      slot.dispatchEvent(move)
    })
    expect(movePrevent).not.toHaveBeenCalled()
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it('cancels long-press when finger moves beyond threshold before delay', async () => {
    vi.useFakeTimers()
    const onEnterEdit = vi.fn()

    await act(async () => {
      root.render(
        <EditableAccueilSlot
          id="eau"
          editMode={false}
          reducedMotion
          dragging={false}
          onEnterEdit={onEnterEdit}
          onHide={() => {}}
          onDragStart={() => {}}
          onDragMove={() => {}}
          onDragEnd={() => {}}
        >
          <div>Eau</div>
        </EditableAccueilSlot>,
      )
    })

    const slot = host.querySelector('[data-accueil-edit-slot="eau"]') as HTMLElement
    act(() => {
      slot.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 2,
          pointerType: 'touch',
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      )
    })
    act(() => {
      slot.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 2,
          pointerType: 'touch',
          clientX: 10,
          clientY: 10 + ACCUEIL_LONG_PRESS_MOVE_PX + 2,
          button: 0,
        }),
      )
    })
    act(() => {
      vi.advanceTimersByTime(ACCUEIL_LONG_PRESS_MS + 50)
    })
    expect(onEnterEdit).not.toHaveBeenCalled()
  })
})
