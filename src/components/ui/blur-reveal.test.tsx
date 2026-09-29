/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlurReveal } from './blur-reveal'
import BlurRevealDemo from './blur-reveal.demo'

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

describe('BlurReveal', () => {
  it('rend le texte lettre par lettre avec un fallback sr-only', async () => {
    await act(async () => {
      root.render(
        <BlurReveal as="h2" className="text-white">
          Tous tes sports.
        </BlurReveal>,
      )
    })
    const el = host.querySelector('[data-blur-reveal]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.tagName).toBe('H2')
    expect(el.getAttribute('data-motion')).toBe('animated')
    expect(host.querySelector('.sr-only')?.textContent).toBe('Tous tes sports.')
    expect(host.textContent).toContain('Tous tes sports.')
  })

  it('force l’état statique quand reducedMotion est true', async () => {
    await act(async () => {
      root.render(<BlurReveal reducedMotion>Statique</BlurReveal>)
    })
    const el = host.querySelector('[data-blur-reveal]') as HTMLElement
    expect(el.getAttribute('data-motion')).toBe('static')
    expect(el.textContent).toBe('Statique')
    expect(host.querySelector('.sr-only')).toBeNull()
  })

  it('démo Motiq affiche le titre', async () => {
    await act(async () => {
      root.render(<BlurRevealDemo />)
    })
    expect(host.textContent).toContain('You can just ship things.')
  })
})
