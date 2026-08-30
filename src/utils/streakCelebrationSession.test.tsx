// @vitest-environment jsdom
import { StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetBodyScrollLockForTests } from './bodyScrollLock'
import {
  __getStreakCelebrationSessionGenerationForTests,
  __resetStreakCelebrationSessionForTests,
  enterStreakCelebrationSession,
  scheduleStreakCelebrationSessionUnmount,
} from './streakCelebrationSession'

function SessionProbe() {
  useLayoutEffect(() => {
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(overlay)

    const generation = enterStreakCelebrationSession(overlay, null)
    return () => {
      overlay.remove()
      scheduleStreakCelebrationSessionUnmount(generation)
    }
  }, [])

  return null
}

describe('streakCelebrationSession — StrictMode', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    __resetBodyScrollLockForTests()
    __resetStreakCelebrationSessionForTests()
  })

  afterEach(() => {
    __resetStreakCelebrationSessionForTests()
  })

  it('acquisition idempotente — une seule lock scroll', async () => {
    const overlay = document.createElement('div')
    overlay.tabIndex = 0
    document.body.append(overlay)

    enterStreakCelebrationSession(overlay, null)
    const generation = enterStreakCelebrationSession(overlay, null)

    expect(document.body.style.overflow).toBe('hidden')
    overlay.remove()
    scheduleStreakCelebrationSessionUnmount(generation)
    await Promise.resolve()
    expect(document.body.style.overflow).toBe('')
  })

  it('attend le retrait réel du portal avant scroll et focus', async () => {
    const previous = document.createElement('button')
    const overlay = document.createElement('div')
    overlay.className = 'streak-celeb'
    overlay.tabIndex = 0
    document.body.append(previous, overlay)
    previous.focus()
    const focusSpy = vi.spyOn(previous, 'focus')

    const generation = enterStreakCelebrationSession(overlay, previous)
    scheduleStreakCelebrationSessionUnmount(generation)
    await Promise.resolve()

    expect(document.body.style.overflow).toBe('hidden')
    expect(focusSpy).not.toHaveBeenCalled()

    overlay.remove()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.style.overflow).toBe('')
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('cleanup différé ne libère pas lors d’un remount StrictMode', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <StrictMode>
          <SessionProbe />
        </StrictMode>,
      )
    })

    expect(document.body.style.overflow).toBe('hidden')
    expect(__getStreakCelebrationSessionGenerationForTests()).toBe(2)

    act(() => {
      root.unmount()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(document.body.style.overflow).toBe('')
    container.remove()
  })
})
