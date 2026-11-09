import { describe, expect, it } from 'vitest'
import {
  clampRemainingToStart,
  drunkMlFromPointerY,
  drunkMlFromRemainingMl,
  drunkMlFromStartAndCurrent,
  fillRatioFromMl,
  remainingMlFromDrunkMl,
  remainingMlFromPointerY,
  waterSurfaceFromBottom,
  WATER_CONTAINER_CAPACITY_ML,
  WATER_FILLABLE,
} from '../../shared/hydration/waterLevel'

describe('hydration waterLevel — départ / final / ml bus', () => {
  it('drunk = max(0, départ − final)', () => {
    expect(drunkMlFromStartAndCurrent(1500, 1500, 1500)).toBe(0)
    expect(drunkMlFromStartAndCurrent(1500, 750, 1500)).toBe(750)
    expect(drunkMlFromStartAndCurrent(1500, 0, 1500)).toBe(1500)
    expect(drunkMlFromStartAndCurrent(800, 300, 1500)).toBe(500)
    // final > départ → 0 (jamais négatif)
    expect(drunkMlFromStartAndCurrent(500, 800, 1500)).toBe(0)
  })

  it('clamp remaining ≤ départ en mode boire', () => {
    expect(clampRemainingToStart(900, 800, 1500)).toBe(800)
    expect(clampRemainingToStart(400, 800, 1500)).toBe(400)
    expect(clampRemainingToStart(-10, 800, 1500)).toBe(0)
  })

  it('round-trip drunk ↔ remaining (capacité pleine)', () => {
    for (const drunk of [0, 250, 500, 750, 1000, 1500]) {
      const rem = remainingMlFromDrunkMl(drunk, 1500)
      expect(drunkMlFromRemainingMl(rem, 1500)).toBe(drunk)
    }
  })

  it('pointeur : haut zone utile = plein remaining ; bas = 0', () => {
    const kind = 'plastic_15' as const
    const capacity = WATER_CONTAINER_CAPACITY_ML.plastic_15
    const rect = { top: 100, height: 200 }
    const { topInset, bottomInset } = WATER_FILLABLE[kind]
    const yTop = rect.top + topInset * rect.height
    const yBottom = rect.top + (1 - bottomInset) * rect.height
    expect(remainingMlFromPointerY(yTop, rect, kind, capacity)).toBe(capacity)
    expect(remainingMlFromPointerY(yBottom, rect, kind, capacity)).toBe(0)
  })

  it('pointeur mode boire plafonné au départ (800) → max 800 bus', () => {
    const kind = 'plastic_15' as const
    const capacity = 1500
    const start = 800
    const rect = { top: 100, height: 200 }
    const { bottomInset } = WATER_FILLABLE[kind]
    const yBottom = rect.top + (1 - bottomInset) * rect.height
    expect(drunkMlFromPointerY(yBottom, rect, kind, capacity, start)).toBe(800)
    const { topInset } = WATER_FILLABLE[kind]
    const yTop = rect.top + topInset * rect.height
    expect(drunkMlFromPointerY(yTop, rect, kind, capacity, start)).toBe(0)
  })

  it('surface remaining cohérente', () => {
    const remaining = 880
    const ratio = fillRatioFromMl(remaining, 1500)
    const surface = waterSurfaceFromBottom('plastic_15', ratio)
    expect(surface).toBeGreaterThan(0)
    expect(drunkMlFromStartAndCurrent(1500, remaining, 1500)).toBe(620)
  })
})
