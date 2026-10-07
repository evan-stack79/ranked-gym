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
    expect(host.querySelector('[aria-label="Profil"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Nouvelle séance"]')).toBeTruthy()
    expect(host.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Train')
    // No visible tab labels in the pill (aria-label only)
    expect(host.textContent).not.toMatch(/Accueil|Train|Nutri|Profil/)
  })
})
