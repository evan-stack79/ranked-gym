/**
 * Niveau d’eau dans un contenant photo (v2) — fonctions pures.
 *
 * Modèle glisser (Evan) :
 * - Contenant démarre PLEIN (remaining = capacité, drunk = 0).
 * - Glisser vers le BAS vide l’eau ; la partie vidée = ml bus.
 * - fillRatio = remaining / capacité (1 = plein, 0 = vide).
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

function safeCapacity(capacityMl: number): number {
  return Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
}

function stepMlValue(ml: number, capacity: number, stepMl: number): number {
  const step = Number.isFinite(stepMl) && stepMl > 0 ? stepMl : 1
  const stepped = Math.round(ml / step) * step
  return Math.min(capacity, Math.max(0, stepped))
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

/** Inverse : surface (depuis le bas, 0–1) → fillRatio (remaining/capacité). */
export function fillRatioFromSurface(
  kind: WaterContainerKind,
  surfaceFromBottom: number,
): number {
  const { topInset, bottomInset } = WATER_FILLABLE[kind]
  const useful = 1 - topInset - bottomInset
  if (useful <= 0) return 0
  return clampFillRatio((surfaceFromBottom - bottomInset) / useful)
}

/** Remaining ml → fillRatio. */
export function mlFromFillRatio(fillRatio: number, capacityMl: number): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  return stepMlValue(clampFillRatio(fillRatio) * capacity, capacity, WATER_LEVEL_STEP_ML)
}

export function fillRatioFromMl(ml: number, capacityMl: number): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  const safe = Number.isFinite(ml) ? Math.max(0, Math.round(ml)) : 0
  return clampFillRatio(safe / capacity)
}

/** ml bus = capacité − remaining. */
export function drunkMlFromRemainingMl(
  remainingMl: number,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  const remaining = Number.isFinite(remainingMl) ? remainingMl : 0
  return stepMlValue(capacity - remaining, capacity, stepMl)
}

/** remaining = capacité − ml bus. */
export function remainingMlFromDrunkMl(
  drunkMl: number,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  const drunk = Number.isFinite(drunkMl) ? drunkMl : 0
  return stepMlValue(capacity - drunk, capacity, stepMl)
}

/**
 * Position Y pointeur → ml bus.
 * Haut de zone utile = 0 bus (plein) ; bas = capacité bus (vide).
 */
export function drunkMlFromPointerY(
  clientY: number,
  fillRect: { top: number; height: number; bottom?: number },
  kind: WaterContainerKind,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0 || !Number.isFinite(clientY)) return 0
  const top = Number.isFinite(fillRect.top) ? fillRect.top : 0
  const height =
    Number.isFinite(fillRect.height) && fillRect.height > 0 ? fillRect.height : 0
  if (height <= 0) return 0
  // 0 en haut de l’image, 1 en bas → surface depuis le bas = 1 − yNorm
  const yNorm = clamp01((clientY - top) / height)
  const surfaceFromBottom = 1 - yNorm
  const remainingRatio = fillRatioFromSurface(kind, surfaceFromBottom)
  const remainingRaw = remainingRatio * capacity
  return drunkMlFromRemainingMl(remainingRaw, capacity, stepMl)
}

/**
 * @deprecated Prefer drunkMlFromPointerY — conservé pour compat tests/visuels restants.
 * Retourne le remaining (plein en haut).
 */
export function mlFromPointerY(
  clientY: number,
  fillRect: { top: number; height: number; bottom?: number },
  kind: WaterContainerKind,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  return remainingMlFromDrunkMl(
    drunkMlFromPointerY(clientY, fillRect, kind, capacity, stepMl),
    capacity,
    stepMl,
  )
}

/** Position CSS `bottom` (%) de la poignée / ménisque (selon fillRatio remaining). */
export function handleBottomPercent(
  kind: WaterContainerKind,
  fillRatio: number,
): number {
  return Math.round(waterSurfaceFromBottom(kind, fillRatio) * 1000) / 10
}
