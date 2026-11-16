/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { attachDialTouchScrollLock } from './dialTouchScrollLock'

describe('attachDialTouchScrollLock', () => {
  it('calls preventDefault on touchmove while dragging, not when idle', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    let dragging = false
    const detach = attachDialTouchScrollLock(el, () => dragging)

    const idle = new TouchEvent('touchmove', { bubbles: true, cancelable: true })
    const idleSpy = vi.spyOn(idle, 'preventDefault')
    el.dispatchEvent(idle)
    expect(idleSpy).not.toHaveBeenCalled()

    dragging = true
    const active = new TouchEvent('touchmove', { bubbles: true, cancelable: true })
    const activeSpy = vi.spyOn(active, 'preventDefault')
    el.dispatchEvent(active)
    expect(activeSpy).toHaveBeenCalledTimes(1)

    detach()
    dragging = true
    const after = new TouchEvent('touchmove', { bubbles: true, cancelable: true })
    const afterSpy = vi.spyOn(after, 'preventDefault')
    el.dispatchEvent(after)
    expect(afterSpy).not.toHaveBeenCalled()

    el.remove()
  })

  it('registers touchmove with passive: false', () => {
    const el = document.createElement('div')
    const addSpy = vi.spyOn(el, 'addEventListener')
    const detach = attachDialTouchScrollLock(el, () => false)
    expect(addSpy).toHaveBeenCalledWith(
      'touchmove',
      expect.any(Function),
      expect.objectContaining({ passive: false }),
    )
    detach()
  })
})
