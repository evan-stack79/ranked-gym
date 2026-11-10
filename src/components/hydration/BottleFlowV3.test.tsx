/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import {
  drunkMlFromStartAndCurrent,
  shouldCommitDrunkOnRelease,
  WATER_DRAG_STEP_ML,
} from '../../shared/hydration'
import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
} from '../../utils/bodyScrollLock'
import {
  BottleFlowV3,
  HydrationUndoToast,
  createUndoOnce,
} from './BottleFlowV3'

describe('BottleFlowV3 — logique variante B', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    __resetBodyScrollLockForTests()
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host?.remove()
    document.querySelectorAll('[data-hydration-bottle-flow="v3b"]').forEach((el) => el.remove())
    __resetBodyScrollLockForTests()
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
  })

  it('relâchement à 0 ml → pas d’ajout', () => {
    expect(shouldCommitDrunkOnRelease(0)).toBe(false)
    expect(
      shouldCommitDrunkOnRelease(
        drunkMlFromStartAndCurrent(1200, 1200, 1500, WATER_DRAG_STEP_ML),
      ),
    ).toBe(false)
  })

  it('relâchement avec 250 ml → ajout', () => {
    const drunk = drunkMlFromStartAndCurrent(1200, 950, 1500, WATER_DRAG_STEP_ML)
    expect(drunk).toBe(250)
    expect(shouldCommitDrunkOnRelease(drunk)).toBe(true)
  })

  it('annulation : un seul undo effectif (pas de double retrait)', () => {
    const undo = vi.fn()
    const once = createUndoOnce(undo)
    expect(once()).toBe(true)
    expect(once()).toBe(false)
    expect(once()).toBe(false)
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('toast Annuler affiche +X ml et barre de temps', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const onUndo = vi.fn()
    const onDismiss = vi.fn()
    act(() => {
      root.render(
        <HydrationUndoToast
          amountMl={250}
          progress={0.62}
          onUndo={onUndo}
          onDismiss={onDismiss}
        />,
      )
    })
    expect(host.textContent).toContain('+250')
    expect(host.textContent).toContain('Annuler')
    expect(host.querySelector('[data-hydration-undo-timer]')).toBeTruthy()
    const btn = host.querySelector('[data-hydration-undo-toast-btn]') as HTMLButtonElement
    act(() => {
      btn.click()
    })
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('overlay portail opaque : body lock + au-dessus du header marque', () => {
    host = document.createElement('div')
    document.body.appendChild(host)

    const header = document.createElement('header')
    header.setAttribute('data-app-brand-header', '1')
    header.style.position = 'sticky'
    header.style.top = '0'
    header.style.zIndex = '30'
    header.textContent = 'Ranked Gym'
    document.body.appendChild(header)

    const tab = document.createElement('nav')
    tab.setAttribute('data-bottom-nav-host', '1')
    tab.style.position = 'fixed'
    tab.style.bottom = '0'
    tab.style.zIndex = '50'
    tab.textContent = 'Scanner Journal'
    document.body.appendChild(tab)

    root = createRoot(host)
    const onClose = vi.fn()
    act(() => {
      root.render(
        <BottleFlowV3
          open
          onClose={onClose}
          initialRemainingMl={1200}
          initialPhase="intro"
          onCommitDrunk={async () => undefined}
        />,
      )
    })

    const overlay = document.querySelector(
      '[data-hydration-bottle-flow="v3b"]',
    ) as HTMLElement | null
    expect(overlay).toBeTruthy()
    expect(overlay!.parentElement).toBe(document.body)
    expect(overlay!.getAttribute('data-hydration-overlay-portal')).toBe('1')
    expect(overlay!.getAttribute('data-hydration-covers-chrome')).toBe('1')
    expect(overlay!.style.backgroundColor.replace(/\s/g, '')).toMatch(/^(#000000|rgb\(0,\s*0,\s*0\))$/)
    const z = Number.parseInt(getComputedStyle(overlay!).zIndex || overlay!.style.zIndex || '0', 10)
    // Tailwind z-[200] may appear in className in jsdom; accept class or computed.
    const classHasZ200 = overlay!.className.includes('z-[200]')
    expect(classHasZ200 || z >= 200).toBe(true)
    expect(z >= 200 || classHasZ200).toBe(true)
    expect(Number.parseInt(header.style.zIndex, 10)).toBeLessThan(200)
    expect(Number.parseInt(tab.style.zIndex, 10)).toBeLessThan(200)

    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCountForTests()).toBeGreaterThanOrEqual(1)

    act(() => {
      root.render(
        <BottleFlowV3
          open={false}
          onClose={onClose}
          initialRemainingMl={1200}
          onCommitDrunk={async () => undefined}
        />,
      )
    })
    expect(document.querySelector('[data-hydration-bottle-flow="v3b"]')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(__getBodyScrollLockCountForTests()).toBe(0)
    // Header inchangé hors overlay
    expect(document.querySelector('[data-app-brand-header="1"]')?.textContent).toContain(
      'Ranked Gym',
    )

    header.remove()
    tab.remove()
  })
})
