/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
} from '../../utils/bodyScrollLock'

vi.mock('./LiveBottleVisual', () => ({
  LiveBottleVisual: (props: {
    onRemainingChange?: (ml: number) => void
    onDragEnd?: () => void
    startRemainingMl?: number
  }) => (
    <button
      type="button"
      data-testid="fake-bottle-drag"
      onClick={() => {
        const start = props.startRemainingMl ?? 1200
        props.onRemainingChange?.(start - 250)
        queueMicrotask(() => props.onDragEnd?.())
      }}
    >
      fake-drag
    </button>
  ),
}))

import { BottleFlowV3 } from './BottleFlowV3'

describe('BottleFlowV3 — commit explicite + Annuler', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    __resetBodyScrollLockForTests()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host?.remove()
    document.querySelectorAll('[data-hydration-bottle-flow="v3b"]').forEach((el) => el.remove())
    __resetBodyScrollLockForTests()
  })

  it('relâchement seul → aucun ajout ; bouton J’ai bu X ml → commit + undo once', async () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const onClose = vi.fn()
    const onCommit = vi.fn(async () => undefined)
    const onUndo = vi.fn(async () => undefined)

    act(() => {
      root.render(
        <BottleFlowV3
          open
          onClose={onClose}
          initialRemainingMl={1200}
          hasMemorizedLevel
          initialPhase="drink"
          captureStartMl={1200}
          captureRemainingMl={1200}
          onCommitDrunk={onCommit}
          onUndoCommit={onUndo}
        />,
      )
    })

    expect(document.querySelector('[data-hydration-bottle-flow="v3b"]')).toBeTruthy()

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="fake-bottle-drag"]')!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Relâchement ne commit plus.
    expect(onCommit).not.toHaveBeenCalled()

    const commitBtn = document.querySelector(
      '[data-hydration-commit-drunk]',
    ) as HTMLButtonElement
    expect(commitBtn).toBeTruthy()
    expect(commitBtn.textContent).toMatch(/J'ai bu/)

    await act(async () => {
      commitBtn.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const commitCalls = onCommit.mock.calls as unknown as Array<
      [{ amountMl: number; remainingAfterMl: number; clientId: string }]
    >
    expect(commitCalls[0]?.[0]?.amountMl).toBe(250)
    expect(commitCalls[0]?.[0]?.clientId).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    const toastBtn = document.querySelector(
      '[data-hydration-undo-toast-btn]',
    ) as HTMLButtonElement
    expect(toastBtn).toBeTruthy()

    await act(async () => {
      toastBtn.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onUndo).toHaveBeenCalledTimes(1)

    await act(async () => {
      toastBtn.click()
      await Promise.resolve()
    })
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(document.querySelector('[data-hydration-bottle-flow="v3b"]')).toBeTruthy()
    expect(__getBodyScrollLockCountForTests()).toBeGreaterThanOrEqual(1)
  })
})
