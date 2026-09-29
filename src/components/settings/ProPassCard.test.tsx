/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProPassCard } from './ProPassCard'

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

describe('ProPassCard', () => {
  it('entoure l’offre Pass Pro d’un BorderBeamPanel', async () => {
    const onTryFree = vi.fn()
    const onDismiss = vi.fn()
    await act(async () => {
      root.render(<ProPassCard onTryFree={onTryFree} onDismiss={onDismiss} />)
    })
    const panel = host.querySelector('[data-border-beam-panel]') as HTMLElement
    expect(panel).toBeTruthy()
    expect(panel.className).not.toMatch(/overflow-hidden/)
    expect(panel.className).toMatch(/border-\[#FF2B2B\]\/40/)
    expect(host.querySelector('.mk-beam-ring')).toBeTruthy()
    expect(host.querySelector('[data-blur-reveal]')).toBeTruthy()
    expect(host.textContent).toContain('Pass Pro')
    expect(host.textContent).toContain('Essayer gratuitement')
    const close = host.querySelector('[aria-label="Fermer l’offre Pass Pro"]') as HTMLButtonElement
    await act(async () => close.click())
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
