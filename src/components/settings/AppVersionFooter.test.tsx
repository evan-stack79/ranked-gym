import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppVersionFooter } from './AppVersionFooter'

describe('AppVersionFooter', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: undefined,
    })
  })

  afterEach(() => {
    host.remove()
    vi.unstubAllGlobals()
  })

  it('affiche la pastille de version sans bouton si pas de SW en attente', async () => {
    const root = createRoot(host)
    await act(async () => {
      root.render(<AppVersionFooter />)
    })

    expect(host.textContent).toContain('Version')
    expect(host.querySelector('[data-testid="app-update-button"]')).toBeNull()
    expect(host.textContent).not.toContain('RPE')
    expect(host.textContent).not.toContain('service worker')

    await act(async () => {
      root.unmount()
    })
  })

  it('montre Mettre à jour quand un SW est en attente', async () => {
    const waiting = { postMessage: vi.fn(), state: 'installed', addEventListener: vi.fn() }
    const registration = {
      waiting,
      installing: null,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistration: vi.fn(async () => registration),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const root = createRoot(host)
    await act(async () => {
      root.render(<AppVersionFooter />)
    })

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="app-update-button"]')?.textContent).toBe(
        'Mettre à jour',
      )
    })

    await act(async () => {
      root.unmount()
    })
  })
})
