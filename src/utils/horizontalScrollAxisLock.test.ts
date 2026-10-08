import { describe, expect, it } from 'vitest'
import {
  AXIS_LOCK_MOVE_PX,
  resolveScrollAxisLock,
} from './horizontalScrollAxisLock'

describe('resolveScrollAxisLock', () => {
  it('returns null until movement exceeds threshold', () => {
    expect(resolveScrollAxisLock(0, 0, 3, 3)).toBeNull()
    expect(resolveScrollAxisLock(0, 0, AXIS_LOCK_MOVE_PX, 0)).toBeNull()
  })

  it('locks vertical when |dy| >= |dx| past threshold', () => {
    expect(resolveScrollAxisLock(0, 0, 4, 12)).toBe('y')
    expect(resolveScrollAxisLock(0, 0, 10, 10)).toBe('y')
    // Diagonal-ish “swipe up to scroll down” — vertical wins
    expect(resolveScrollAxisLock(100, 200, 100 + 18, 200 - 40)).toBe('y')
  })

  it('locks horizontal when |dx| > |dy| past threshold', () => {
    expect(resolveScrollAxisLock(0, 0, 20, 4)).toBe('x')
    expect(resolveScrollAxisLock(0, 0, -30, 10)).toBe('x')
  })
})
