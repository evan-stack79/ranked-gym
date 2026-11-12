/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveBottleVisual } from './LiveBottleVisual'

describe('LiveBottleVisual — iOS image callout lock', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  it('shell images are non-draggable and block contextmenu', async () => {
    await act(async () => {
      root.render(
        <LiveBottleVisual
          kind="plastic_15"
          remainingMl={750}
          capacityMl={1500}
          interactive
          onRemainingChange={vi.fn()}
        />,
      )
    })

    const zone = host.querySelector('[data-hydration-live-bottle]') as HTMLElement | null
    expect(zone).toBeTruthy()

    const shells = [...host.querySelectorAll('[data-hydration-shell], img')] as HTMLImageElement[]
    expect(shells.length).toBeGreaterThanOrEqual(1)
    for (const img of shells) {
      expect(img.draggable).toBe(false)
    }

    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const prevented = !zone!.dispatchEvent(evt)
    expect(prevented || evt.defaultPrevented).toBe(true)
  })

  it('CSS locks touch-callout on hydration container selectors', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/\[data-hydration-live-bottle\]/)
    expect(css).toMatch(/\[data-hydration-shell\]/)
    expect(css).toMatch(/-webkit-touch-callout:\s*none/)
    expect(css).toMatch(/\.hydration-no-callout/)
  })
})
