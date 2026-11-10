/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import {
  drunkMlFromStartAndCurrent,
  shouldCommitDrunkOnRelease,
  WATER_DRAG_STEP_ML,
} from '../../shared/hydration'
import { HydrationUndoToast, createUndoOnce } from './BottleFlowV3'

describe('BottleFlowV3 — logique variante B', () => {
  let host: HTMLDivElement
  let root: Root

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host?.remove()
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
})
