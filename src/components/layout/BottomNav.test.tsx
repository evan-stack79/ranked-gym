/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

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

describe('BottomNav centre', () => {
  it('dock : 5 onglets dont Sommeil avant Profil', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="sleep"
          onTabChange={vi.fn()}
          hasActiveWorkout={false}
          floatingPill={false}
        />,
      )
    })
    const tabs = [...host.querySelectorAll('[data-nav-tab]')].map((el) =>
      el.getAttribute('data-nav-tab'),
    )
    expect(tabs).toEqual(['home', 'training', 'nutrition', 'sleep', 'profile'])
    expect(host.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe(
      'Sommeil',
    )
  })

  it('Nouvelle séance s’il n’y a pas de brouillon (dock)', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="training"
          onTabChange={vi.fn()}
          hasActiveWorkout={false}
          floatingPill={false}
        />,
      )
    })
    expect(host.textContent).toContain('Nouvelle séance')
    expect(host.querySelector('[data-nav-center="new"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Démarrer')
    expect(host.querySelector('[data-bottom-nav-variant="dock"]')).toBeTruthy()
  })

  it('Reprendre si une séance est active (dock)', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="training"
          onTabChange={vi.fn()}
          hasActiveWorkout
          floatingPill={false}
        />,
      )
    })
    expect(host.textContent).toContain('Reprendre')
    expect(host.querySelector('[data-nav-center="resume"]')).toBeTruthy()
    expect(host.textContent).not.toContain('Nouvelle séance')
  })

  it('floating pill : icons only, same tabs + aria-labels, prominent centre', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="training"
          onTabChange={vi.fn()}
          hasActiveWorkout={false}
          floatingPill
        />,
      )
    })
    const nav = host.querySelector('[data-bottom-nav-variant="floating-pill"]')
    expect(nav).toBeTruthy()
    expect(host.querySelector('[aria-label="Accueil"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Train"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Nutri"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Sommeil"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Profil"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Nouvelle séance"]')).toBeTruthy()
    expect(host.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Train')
    // No visible tab labels in the pill (aria-label only)
    expect(host.textContent).not.toMatch(/Accueil|Train|Nutri|Sommeil|Profil/)
  })

  it('floating pill : liquid-glass bubble slides to active tab (skips centre play)', async () => {
    const tabLeft: Record<string, number> = {
      home: 8,
      training: 64,
      nutrition: 176,
      sleep: 232,
      profile: 288,
    }
    const rect = (left: number, width: number, height = 44) =>
      ({
        x: left,
        y: 0,
        top: 0,
        left,
        bottom: height,
        right: left + width,
        width,
        height,
        toJSON: () => ({}),
      }) satisfies DOMRect

    const gbr = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('bottom-nav-pill__track')) return rect(0, 320)
      const tabId = this.getAttribute('data-nav-tab')
      if (tabId && tabId in tabLeft) return rect(tabLeft[tabId]!, 56)
      return rect(0, 0)
    })

    try {
      await act(async () => {
        root.render(
          <BottomNav
            activeTab="home"
            onTabChange={vi.fn()}
            hasActiveWorkout={false}
            floatingPill
          />,
        )
      })

      const bubble = host.querySelector('[data-nav-bubble]') as HTMLElement | null
      expect(bubble).toBeTruthy()
      expect(bubble?.getAttribute('aria-hidden')).toBe('true')
      expect(bubble?.getAttribute('data-ready')).toBe('true')
      expect(host.querySelector('[data-nav-center]')).toBeTruthy()
      expect(host.querySelectorAll('[data-nav-tab]')).toHaveLength(5)
      expect(host.querySelector('[data-nav-tab="sleep"]')).toBeTruthy()

      // home: left 8 + (56-36)/2 = 18
      expect(bubble!.style.transform).toBe('translate3d(18px, -50%, 0)')

      await act(async () => {
        root.render(
          <BottomNav
            activeTab="profile"
            onTabChange={vi.fn()}
            hasActiveWorkout={false}
            floatingPill
          />,
        )
      })

      expect(host.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Profil')
      // profile: left 288 + (56-36)/2 = 298
      expect((host.querySelector('[data-nav-bubble]') as HTMLElement).style.transform).toBe(
        'translate3d(298px, -50%, 0)',
      )
    } finally {
      gbr.mockRestore()
    }
  })
})
