/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BorderBeamPanel } from './border-beam-panel'
import BorderBeamPanelDemo from './border-beam-panel.demo'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('BorderBeamPanel', () => {
  it('rend le contenu et le ring animé par défaut', async () => {
    await act(async () => {
      root.render(
        <BorderBeamPanel beams={2} glow>
          <p>Pass Pro</p>
        </BorderBeamPanel>,
      )
    })
    expect(host.querySelector('[data-border-beam-panel]')).toBeTruthy()
    expect(host.querySelector('[data-motion="animated"]')).toBeTruthy()
    expect(host.querySelector('.mk-beam-ring')).toBeTruthy()
    expect(host.querySelector('.mk-beam-glow')).toBeTruthy()
    expect(host.textContent).toContain('Pass Pro')
  })

  it('force l’état statique quand reducedMotion est true', async () => {
    await act(async () => {
      root.render(
        <BorderBeamPanel reducedMotion>
          <p>Statique</p>
        </BorderBeamPanel>,
      )
    })
    expect(host.querySelector('[data-motion="static"]')).toBeTruthy()
  })

  it('démo Motiq affiche le titre et le CTA', async () => {
    await act(async () => {
      root.render(<BorderBeamPanelDemo />)
    })
    expect(host.textContent).toContain('Border Beam Panel')
    expect(host.textContent).toContain('Get started')
  })
})
