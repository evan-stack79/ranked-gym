import { describe, expect, it } from 'vitest'
import {
  fillRatioFromMl,
  fillRatioFromSurface,
  handleBottomPercent,
  mlFromFillRatio,
  mlFromPointerY,
  waterSurfaceFromBottom,
  WATER_CONTAINER_CAPACITY_ML,
  WATER_FILLABLE,
} from '../../shared/hydration/waterLevel'

describe('hydration waterLevel — ml ↔ position', () => {
  it('surface 1,5 L à 620/1500 matche les insets maquette', () => {
    const ratio = 620 / 1500
    const surface = waterSurfaceFromBottom('plastic_15', ratio)
    const { topInset, bottomInset } = WATER_FILLABLE.plastic_15
    const useful = 1 - topInset - bottomInset
    expect(surface).toBeCloseTo(bottomInset + ratio * useful, 5)
    expect(fillRatioFromSurface('plastic_15', surface)).toBeCloseTo(ratio, 5)
    expect(mlFromFillRatio(ratio, 1500)).toBe(620)
  })

  it('round-trip ml → fillRatio → ml (pas 10 ml)', () => {
    for (const ml of [0, 250, 500, 750, 1000, 1500]) {
      const r = fillRatioFromMl(ml, 1500)
      expect(mlFromFillRatio(r, 1500)).toBe(ml)
    }
  })

  it('pointeur en bas → 0 ml, pointeur en haut de zone utile → capacité', () => {
    const kind = 'plastic_15' as const
    const capacity = WATER_CONTAINER_CAPACITY_ML.plastic_15
    const rect = { top: 100, height: 200, bottom: 300 }
    const { topInset, bottomInset } = WATER_FILLABLE[kind]
    // Bas de zone utile
    const yBottom = rect.top + (1 - bottomInset) * rect.height
    expect(mlFromPointerY(yBottom, rect, kind, capacity)).toBe(0)
    // Haut de zone utile
    const yTop = rect.top + topInset * rect.height
    expect(mlFromPointerY(yTop, rect, kind, capacity)).toBe(capacity)
  })

  it('verre 25 cl et petite bouteille 50 cl', () => {
    expect(mlFromFillRatio(1, WATER_CONTAINER_CAPACITY_ML.glass_25)).toBe(250)
    expect(mlFromFillRatio(0.5, WATER_CONTAINER_CAPACITY_ML.small_50)).toBe(250)
    expect(handleBottomPercent('glass_25', 0.55)).toBeGreaterThan(10)
    expect(handleBottomPercent('glass_25', 0.55)).toBeLessThan(90)
  })

  it('clamp hors bornes', () => {
    expect(mlFromFillRatio(2, 500)).toBe(500)
    expect(mlFromFillRatio(-1, 500)).toBe(0)
    expect(fillRatioFromMl(9999, 500)).toBe(1)
    expect(waterSurfaceFromBottom('gourd', 2)).toBeLessThanOrEqual(1)
  })
})
