import { describe, expect, it } from 'vitest'
import {
  normalizePersistedRestTimer,
  remainingFromPersisted,
} from './restTimerPersist'

describe('restTimerPersist', () => {
  it('rejette un snapshot corrompu sans inventer de valeurs', () => {
    expect(normalizePersistedRestTimer(null)).toBeNull()
    expect(normalizePersistedRestTimer({})).toBeNull()
    expect(
      normalizePersistedRestTimer({
        totalSec: 90,
        remainingSec: 40,
        endsAt: 1,
        paused: false,
        target: { exerciseId: '', setIndex: 0, exerciseName: 'A', setLabel: 'S1' },
      }),
    ).toBeNull()
  })

  it('restaure remaining depuis endsAt (refresh) et respecte la pause', () => {
    const snap = normalizePersistedRestTimer({
      totalSec: 90,
      remainingSec: 40,
      endsAt: 1_000_000 + 40_000,
      paused: false,
      target: {
        exerciseId: 'ex-1',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'Série 1',
      },
    })
    expect(snap).not.toBeNull()
    expect(remainingFromPersisted(snap!, 1_000_000 + 10_000)).toBe(30)
    const paused = { ...snap!, paused: true, remainingSec: 22 }
    expect(remainingFromPersisted(paused, 1_000_000 + 80_000)).toBe(22)
  })
})
