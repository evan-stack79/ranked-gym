// @vitest-environment jsdom
/**
 * Boundary locale — overlay qui throw au render.
 */
import { forwardRef, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
} from '../../utils/bodyScrollLock'
import {
  __getStreakCelebrationSessionGenerationForTests,
  __resetStreakCelebrationSessionForTests,
} from '../../utils/streakCelebrationSession'

const clearStreakCelebration = vi.fn()
const streakCelebration = {
  previousStreak: 1,
  currentStreak: 2,
  dateKey: '2026-08-30',
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    streakCelebration,
    clearStreakCelebration,
  }),
}))

vi.mock('./StreakCelebrationOverlay', () => ({
  StreakCelebrationOverlay: forwardRef<HTMLDivElement>(function ErrorAfterMount(_, ref) {
    const [explode, setExplode] = useState(false)
    useLayoutEffect(() => setExplode(true), [])
    if (explode) throw new Error('post-mount boom')
    return <div ref={ref} className="streak-celeb" role="dialog" tabIndex={0} />
  }),
}))

import { StreakCelebrationHost } from './StreakCelebrationHost'

describe('StreakCelebrationHost — erreur overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    __resetBodyScrollLockForTests()
    __resetStreakCelebrationSessionForTests()
    clearStreakCelebration.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('boundary locale restaure une fois après une erreur post-acquisition', async () => {
    const shellRef = { current: document.createElement('div') }
    document.body.append(shellRef.current)
    const previous = document.createElement('button')
    document.body.append(previous)
    previous.focus()
    const focusSpy = vi.spyOn(previous, 'focus')

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StreakCelebrationHost shellRef={shellRef} />)
      await Promise.resolve()
    })

    expect(clearStreakCelebration).toHaveBeenCalledTimes(1)
    expect(__getStreakCelebrationSessionGenerationForTests()).toBeGreaterThan(0)
    expect(document.body.style.overflow).toBe('')
    expect(__getBodyScrollLockCountForTests()).toBe(0)
    expect(document.body.querySelector('.streak-celeb')).toBeNull()
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(previous)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
