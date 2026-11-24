import { describe, expect, it } from 'vitest'
import {
  computeSunTimes,
  floorHmTo5Minutes,
  formatSoleilSeCouchePhrase,
  TERGNIER_COORDS,
} from './sunset'

describe('sunset B2 — NOAA + floor 5 min', () => {
  it('Tergnier 24/11 → 16:55 (floor aux 5 min avant)', () => {
    const d = new Date(2026, 10, 24) // 24 nov local
    const sun = computeSunTimes(
      d,
      TERGNIER_COORDS.latitude,
      TERGNIER_COORDS.longitude,
    )
    expect(sun.unknown).toBe(false)
    expect(sun.sunsetDisplayHm).toBe('16:55')
    expect(formatSoleilSeCouchePhrase(sun.sunsetDisplayHm)).toBe(
      'Le soleil se couche à 16:55.',
    )
  })

  it('arrondi toujours vers le bas (jamais après)', () => {
    expect(floorHmTo5Minutes('16:56')).toBe('16:55')
    expect(floorHmTo5Minutes('16:59')).toBe('16:55')
    expect(floorHmTo5Minutes('16:55')).toBe('16:55')
    expect(floorHmTo5Minutes('17:00')).toBe('17:00')
    expect(floorHmTo5Minutes('17:04')).toBe('17:00')
    expect(floorHmTo5Minutes('12:01')).toBe('12:00')
  })

  it('ne code pas en dur 17:00 : été ≠ hiver à Tergnier', () => {
    const winter = computeSunTimes(
      new Date(2026, 10, 24),
      TERGNIER_COORDS.latitude,
      TERGNIER_COORDS.longitude,
    )
    const summer = computeSunTimes(
      new Date(2026, 5, 21),
      TERGNIER_COORDS.latitude,
      TERGNIER_COORDS.longitude,
    )
    expect(winter.sunsetDisplayHm).not.toBe(summer.sunsetDisplayHm)
    // En juin le soleil se couche nettement après 20 h (CET/CEST)
    const [sh] = summer.sunsetDisplayHm.split(':').map(Number)
    expect(sh).toBeGreaterThanOrEqual(20)
  })

  it('phrase imposée Vérificateur (pas « Il fera nuit »)', () => {
    expect(formatSoleilSeCouchePhrase('16:55')).toBe(
      'Le soleil se couche à 16:55.',
    )
    expect(formatSoleilSeCouchePhrase('16:55')).not.toMatch(/fera nuit/i)
  })
})
