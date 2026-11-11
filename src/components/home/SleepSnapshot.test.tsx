/** @vitest-environment jsdom */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SleepSnapshot } from './SleepSnapshot'
import { saveSleepNight, saveSleepSchedule } from '../../services/sleepStorage'

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

describe('SleepSnapshot v10 summary card', () => {
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

  it('affiche durée typo + Noter, ouvre l’éditeur inline', () => {
    const today = new Date()
    const y = today.getFullYear()
    const mo = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateKey = `${y}-${mo}-${d}`

    saveSleepSchedule({ bedtime: '23:00', waketime: '07:00' }, { skipCloud: true })
    saveSleepNight(
      { bedtime: '23:00', waketime: '06:30', tstHours: null, dateKey },
      { skipCloud: true },
    )

    act(() => {
      root.render(<SleepSnapshot />)
    })

    expect(host.textContent).toContain("Comment s'est passée ta nuit")
    expect(host.textContent).toMatch(/30/)
    expect(host.textContent).toContain('ton objectif')
    expect(host.querySelector('[data-sleep-primary-action="modifier"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Au réveil')

    act(() => {
      ;(host.querySelector('[data-sleep-primary-action="modifier"]') as HTMLButtonElement).click()
    })

    expect(host.querySelector('[data-sleep-inline-editor]')).toBeTruthy()
    expect(host.querySelector('[data-sleep-clock-dial]')).toBeTruthy()
  })

  it('état vide : bouton Noter', () => {
    act(() => {
      root.render(<SleepSnapshot />)
    })
    expect(host.querySelector('[data-sleep-primary-action="noter"]')).toBeTruthy()
    expect(host.textContent).toContain('z z')
  })
})
