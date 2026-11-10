import { describe, expect, it } from 'vitest'
import {
  clampRemainingToStart,
  drunkMlFromPointerY,
  drunkMlFromRemainingMl,
  drunkMlFromStartAndCurrent,
  fillRatioFromMl,
  remainingMlFromDrunkMl,
  remainingMlFromPointerY,
  shouldCommitDrunkOnRelease,
  waterSurfaceFromBottom,
  WATER_CONTAINER_CAPACITY_ML,
  WATER_DRAG_STEP_ML,
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

  it('variante B : commit au relâchement seulement si ml bus > 0', () => {
    expect(shouldCommitDrunkOnRelease(0)).toBe(false)
    expect(shouldCommitDrunkOnRelease(-1)).toBe(false)
    expect(shouldCommitDrunkOnRelease(Number.NaN)).toBe(false)
    expect(shouldCommitDrunkOnRelease(1)).toBe(true)
    expect(shouldCommitDrunkOnRelease(250)).toBe(true)
  })

  it('étape 1 non comptée : drunk à départ = final est 0', () => {
    expect(drunkMlFromStartAndCurrent(1200, 1200, 1500, WATER_DRAG_STEP_ML)).toBe(0)
  })

  it('précision doigt 1 ml (bornes 0…capacité)', () => {
    const kind = 'plastic_15' as const
    const capacity = 1500
    const rect = { top: 0, height: 1000 }
    const mid = remainingMlFromPointerY(500, rect, kind, capacity, WATER_DRAG_STEP_ML)
    expect(mid % 1).toBe(0)
    expect(mid).toBeGreaterThanOrEqual(0)
    expect(mid).toBeLessThanOrEqual(capacity)
    // Pas forcé au pas 10
    const near = remainingMlFromPointerY(501, rect, kind, capacity, WATER_DRAG_STEP_ML)
    expect(Math.abs(near - mid)).toBeLessThanOrEqual(5)
  })

  it('bu au relâchement = départ − final (ex. 1200 → 950 = 250)', () => {
    expect(drunkMlFromStartAndCurrent(1200, 950, 1500, WATER_DRAG_STEP_ML)).toBe(250)
  })
})
