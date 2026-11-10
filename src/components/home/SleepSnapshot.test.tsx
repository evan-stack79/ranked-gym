/** @vitest-environment jsdom */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SleepSnapshot } from './SleepSnapshot'
import { saveSleepNight } from '../../services/sleepStorage'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
})

vi.mock('../../services/cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('../../services/cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('SleepSnapshot Accueil card', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    store.clear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('affiche le TIB et ouvre l’écran Sommeil au tap', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '06:30', tstHours: null, dateKey: '2026-11-10' },
      { skipCloud: true },
    )

    act(() => {
      root.render(<SleepSnapshot />)
    })

    expect(host.textContent).toContain('7 h 30 au lit')
    expect(host.textContent).toMatch(/23:00 → 6:30/)

    const card = host.querySelector('[data-sleep-home-card]') as HTMLButtonElement
    expect(card).toBeTruthy()

    act(() => {
      card.click()
    })

    expect(document.body.textContent).toContain('Ma semaine')
    expect(document.body.textContent).toContain('Noter ma nuit')
    expect(document.body.textContent).not.toContain('Au réveil')
  })
})
