import { describe, expect, it } from 'vitest'
import {
  drunkMlFromPointerY,
  drunkMlFromRemainingMl,
  fillRatioFromMl,
  fillRatioFromSurface,
  handleBottomPercent,
  mlFromFillRatio,
  remainingMlFromDrunkMl,
  waterSurfaceFromBottom,
  WATER_CONTAINER_CAPACITY_ML,
  WATER_FILLABLE,
} from '../../shared/hydration/waterLevel'

describe('hydration waterLevel — ml bus ↔ position (glisser inverse)', () => {
  it('remaining plein → 0 bus ; remaining 0 → capacité bus', () => {
    expect(drunkMlFromRemainingMl(1500, 1500)).toBe(0)
    expect(drunkMlFromRemainingMl(0, 1500)).toBe(1500)
    expect(drunkMlFromRemainingMl(750, 1500)).toBe(750)
    expect(remainingMlFromDrunkMl(0, 1500)).toBe(1500)
    expect(remainingMlFromDrunkMl(1500, 1500)).toBe(0)
    expect(remainingMlFromDrunkMl(620, 1500)).toBe(880)
  })

  it('round-trip drunk ↔ remaining (pas 10 ml)', () => {
    for (const drunk of [0, 250, 500, 750, 1000, 1500]) {
      const rem = remainingMlFromDrunkMl(drunk, 1500)
      expect(drunkMlFromRemainingMl(rem, 1500)).toBe(drunk)
    }
  })

  it('pointeur en haut de zone utile → 0 bus ; en bas → capacité bus', () => {
    const kind = 'plastic_15' as const
    const capacity = WATER_CONTAINER_CAPACITY_ML.plastic_15
    const rect = { top: 100, height: 200, bottom: 300 }
    const { topInset, bottomInset } = WATER_FILLABLE[kind]
    const yBottom = rect.top + (1 - bottomInset) * rect.height
    const yTop = rect.top + topInset * rect.height
    expect(drunkMlFromPointerY(yTop, rect, kind, capacity)).toBe(0)
    expect(drunkMlFromPointerY(yBottom, rect, kind, capacity)).toBe(capacity)
  })

  it('mi-hauteur utile ≈ moitié capacité bus', () => {
    const kind = 'plastic_15' as const
    const capacity = WATER_CONTAINER_CAPACITY_ML.plastic_15
    const rect = { top: 100, height: 200 }
    const { topInset, bottomInset } = WATER_FILLABLE[kind]
    const useful = 1 - topInset - bottomInset
    const yMid = rect.top + (topInset + useful / 2) * rect.height
    const drunk = drunkMlFromPointerY(yMid, rect, kind, capacity)
    expect(drunk).toBe(750)
  })

  it('surface remaining 880/1500 (620 bus) matche insets', () => {
    const remaining = 880
    const ratio = fillRatioFromMl(remaining, 1500)
    const surface = waterSurfaceFromBottom('plastic_15', ratio)
    const { topInset, bottomInset } = WATER_FILLABLE.plastic_15
    const useful = 1 - topInset - bottomInset
    expect(surface).toBeCloseTo(bottomInset + ratio * useful, 5)
    expect(fillRatioFromSurface('plastic_15', surface)).toBeCloseTo(ratio, 5)
    expect(mlFromFillRatio(ratio, 1500)).toBe(880)
    expect(drunkMlFromRemainingMl(remaining, 1500)).toBe(620)
  })

  it('verre 25 cl et petite bouteille 50 cl', () => {
    expect(remainingMlFromDrunkMl(0, WATER_CONTAINER_CAPACITY_ML.glass_25)).toBe(250)
    expect(drunkMlFromRemainingMl(120, WATER_CONTAINER_CAPACITY_ML.small_50)).toBe(380)
    expect(handleBottomPercent('glass_25', 0.55)).toBeGreaterThan(10)
    expect(handleBottomPercent('glass_25', 0.55)).toBeLessThan(90)
  })

  it('clamp hors bornes', () => {
    expect(drunkMlFromRemainingMl(-10, 500)).toBe(500)
    expect(drunkMlFromRemainingMl(9999, 500)).toBe(0)
    expect(remainingMlFromDrunkMl(-10, 500)).toBe(500)
    expect(remainingMlFromDrunkMl(9999, 500)).toBe(0)
    expect(waterSurfaceFromBottom('gourd', 2)).toBeLessThanOrEqual(1)
  })
})
