/**
 * Chronomètre de séance Train — durée réelle vs estimation.
 * Champs optionnels sur ActiveWorkoutDraft (rétrocompatibles).
 */
import { describe, expect, it } from 'vitest'
import {
  ensureDraftClock,
  estimatedElapsedMin,
  formatSessionClock,
  hasDraftClockFields,
  liveElapsedMin,
  liveElapsedMs,
  pauseDraftClock,
  resolvedDurationMin,
  resumeDraftClock,
} from './sessionClock'
import type { ActiveWorkoutDraft } from '../types/training'

const base: ActiveWorkoutDraft = {
  routineId: 'push',
  sportId: 'musculation',
  startedAt: 1_000_000,
  updatedAt: 1_000_000,
}

describe('sessionClock', () => {
  it('legacy sans clock : mesure démarre à la reprise, startedAt = estimation seule', () => {
    const ensured = ensureDraftClock(base, 1_060_000)
    expect(hasDraftClockFields(base)).toBe(false)
    expect(ensured.paused).toBe(false)
    expect(ensured.runningSince).toBe(1_060_000)
    expect(ensured.elapsedActiveMs).toBe(0)
    expect(ensured.estimatedElapsedMs).toBe(60_000)
    // Durée réelle = 0 à l’instant de reprise (pas wall-clock depuis startedAt)
    expect(liveElapsedMs(ensured, 1_060_000)).toBe(0)
    expect(liveElapsedMs(ensured, 1_090_000)).toBe(30_000)
    expect(estimatedElapsedMin(ensured)).toBe(1)
    expect(resolvedDurationMin(ensured, 1_060_000)).toBe(1)
    expect(resolvedDurationMin(ensured, 1_090_000)).toBe(1)
  })

  it('ne transforme pas startedAt en durée chronométrée', () => {
    const ensured = ensureDraftClock(base, 1_600_000)
    expect(liveElapsedMin(ensured, 1_600_000)).toBe(0)
    expect(ensured.startedAt).toBe(1_000_000)
    expect(ensured.estimatedElapsedMs).toBe(600_000)
  })

  it('préserve la pause au rafraîchissement (elapsed figé)', () => {
    const running = ensureDraftClock(
      { ...base, elapsedActiveMs: 0, runningSince: 1_000_000, paused: false },
      1_030_000,
    )
    const paused = pauseDraftClock(running, 1_030_000)
    expect(paused.paused).toBe(true)
    expect(paused.runningSince).toBeNull()
    expect(paused.elapsedActiveMs).toBe(30_000)
    expect(liveElapsedMs(paused, 1_090_000)).toBe(30_000)
    const resumed = resumeDraftClock(paused, 1_090_000)
    expect(resumed.paused).toBe(false)
    expect(resumed.runningSince).toBe(1_090_000)
    expect(liveElapsedMs(resumed, 1_100_000)).toBe(40_000)
  })

  it('formate sans NaN', () => {
    expect(formatSessionClock(0)).toBe('00:00')
    expect(formatSessionClock(65_000)).toBe('01:05')
    expect(formatSessionClock(3_661_000)).toBe('1:01:01')
    expect(formatSessionClock(Number.NaN)).toBe('00:00')
  })
})
