/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

import confetti from 'canvas-confetti'
import {
  fireRankUpConfetti,
  fireRankUpConfettiSalve1,
  RANK_UP_CONFETTI_COLORS,
} from './rankUpConfetti'

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && String(query).includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('rankUpConfetti', () => {
  beforeEach(() => {
    vi.mocked(confetti).mockClear()
    mockMatchMedia(false)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses brand colors only (red / white / dark grey)', () => {
    expect([...RANK_UP_CONFETTI_COLORS]).toEqual(['#ff0702', '#ffffff', '#42484c'])
  })

  it('fires two salves when motion is allowed', () => {
    const { launched, cancel } = fireRankUpConfetti({ reducedMotion: false })
    expect(launched).toBe(true)
    expect(confetti).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(250)
    expect(confetti).toHaveBeenCalledTimes(3)
    cancel()
  })

  it('prefers-reduced-motion: confetti never launched', () => {
    mockMatchMedia(true)
    const { launched } = fireRankUpConfetti()
    expect(launched).toBe(false)
    expect(confetti).not.toHaveBeenCalled()
    expect(fireRankUpConfettiSalve1()).toBe(false)
    expect(confetti).not.toHaveBeenCalled()
  })

  it('explicit reducedMotion: true skips even if matchMedia allows', () => {
    const { launched } = fireRankUpConfetti({ reducedMotion: true })
    expect(launched).toBe(false)
    expect(confetti).not.toHaveBeenCalled()
  })
})
