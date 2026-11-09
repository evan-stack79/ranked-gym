/**
 * Niveau d’eau dans un contenant photo (v2) — fonctions pures.
 * fillRatio = ml / capacité (1 = plein). Surface depuis le bas de l’image.
 */

export type WaterContainerKind = 'plastic_15' | 'small_50' | 'glass_25' | 'gourd'

/** Zone utile hors bouchon / col / base (fractions de la hauteur image). */
export const WATER_FILLABLE: Record<
  WaterContainerKind,
  { topInset: number; bottomInset: number }
> = {
  plastic_15: { topInset: 0.155, bottomInset: 0.035 },
  small_50: { topInset: 0.14, bottomInset: 0.04 },
  glass_25: { topInset: 0.06, bottomInset: 0.12 },
  gourd: { topInset: 0.12, bottomInset: 0.03 },
}

export const WATER_CONTAINER_CAPACITY_ML: Record<
  Exclude<WaterContainerKind, 'gourd'>,
  number
> = {
  plastic_15: 1500,
  small_50: 500,
  glass_25: 250,
}

export const WATER_LEVEL_STEP_ML = 10

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export function clampFillRatio(fillRatio: number): number {
  return clamp01(fillRatio)
}

/** Hauteur de la surface d’eau depuis le bas (0–1), hors insets. */
export function waterSurfaceFromBottom(
  kind: WaterContainerKind,
  fillRatio: number,
): number {
  const { topInset, bottomInset } = WATER_FILLABLE[kind]
  const useful = 1 - topInset - bottomInset
  return bottomInset + clampFillRatio(fillRatio) * useful
}

/** Inverse : surface (depuis le bas, 0–1) → fillRatio. */
export function fillRatioFromSurface(
  kind: WaterContainerKind,
  surfaceFromBottom: number,
): number {
  const { topInset, bottomInset } = WATER_FILLABLE[kind]
  const useful = 1 - topInset - bottomInset
  if (useful <= 0) return 0
  return clampFillRatio((surfaceFromBottom - bottomInset) / useful)
}

export function mlFromFillRatio(fillRatio: number, capacityMl: number): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const raw = clampFillRatio(fillRatio) * capacity
  const stepped = Math.round(raw / WATER_LEVEL_STEP_ML) * WATER_LEVEL_STEP_ML
  return Math.min(capacity, Math.max(0, stepped))
}

export function fillRatioFromMl(ml: number, capacityMl: number): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const safe = Number.isFinite(ml) ? Math.max(0, Math.round(ml)) : 0
  return clampFillRatio(safe / capacity)
}

/**
 * Position Y pointeur (viewport) → ml dans le contenant.
 * `fillRect` = boîte CSS de l’image (getBoundingClientRect).
 */
export function mlFromPointerY(
  clientY: number,
  fillRect: { top: number; height: number; bottom?: number },
  kind: WaterContainerKind,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0 || !Number.isFinite(clientY)) return 0
  const top = Number.isFinite(fillRect.top) ? fillRect.top : 0
  const height =
    Number.isFinite(fillRect.height) && fillRect.height > 0 ? fillRect.height : 0
  if (height <= 0) return 0
  // 0 en haut de l’image, 1 en bas → surface depuis le bas = 1 − yNorm
  const yNorm = clamp01((clientY - top) / height)
  const surfaceFromBottom = 1 - yNorm
  const ratio = fillRatioFromSurface(kind, surfaceFromBottom)
  const raw = ratio * capacity
  const step = Number.isFinite(stepMl) && stepMl > 0 ? stepMl : 1
  const stepped = Math.round(raw / step) * step
  return Math.min(capacity, Math.max(0, stepped))
}

/** Position CSS `bottom` (%) de la poignée / ménisque. */
export function handleBottomPercent(
  kind: WaterContainerKind,
  fillRatio: number,
): number {
  return Math.round(waterSurfaceFromBottom(kind, fillRatio) * 1000) / 10
}
