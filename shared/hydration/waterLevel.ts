/**
 * Niveau d’eau dans un contenant photo (v2) — fonctions pures.
 *
 * Modèle glisser (Evan) :
 * 1) Régler le niveau de départ (remaining, 0…capacité) — ne compte pas comme bu.
 * 2) Mode boire : glisser vers le BAS ; ml bus = départ − final (≥ 0).
 *    Impossible de remonter au-dessus du niveau de départ.
 * fillRatio = remaining / capacité (1 = plein, 0 = vide).
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

/** Précision au doigt (glisser) — 1 ml, bornes 0…capacité. */
export const WATER_DRAG_STEP_ML = 1

/**
 * Variante B : au relâchement, n’ajouter que si ml bus > 0.
 * (0 ml → aucun ajout.)
 */
export function shouldCommitDrunkOnRelease(drunkMl: number): boolean {
  return Number.isFinite(drunkMl) && Math.round(drunkMl) > 0
}

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

/** Remaining depuis le pointeur (haut = plein, bas = vide). */
export function remainingMlFromPointerY(
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
  const yNorm = clamp01((clientY - top) / height)
  const surfaceFromBottom = 1 - yNorm
  const remainingRatio = fillRatioFromSurface(kind, surfaceFromBottom)
  return stepMlValue(remainingRatio * capacity, capacity, stepMl)
}

/**
 * Mode boire : remaining plafonné au niveau de départ (pas de remontée).
 */
export function clampRemainingToStart(
  remainingMl: number,
  startRemainingMl: number,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  const start = stepMlValue(
    Number.isFinite(startRemainingMl) ? startRemainingMl : capacity,
    capacity,
    stepMl,
  )
  const remaining = stepMlValue(
    Number.isFinite(remainingMl) ? remainingMl : 0,
    capacity,
    stepMl,
  )
  return Math.min(start, remaining)
}

/** ml bus = max(0, départ − final). */
export function drunkMlFromStartAndCurrent(
  startRemainingMl: number,
  currentRemainingMl: number,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (capacity <= 0) return 0
  const start = stepMlValue(
    Number.isFinite(startRemainingMl) ? startRemainingMl : capacity,
    capacity,
    stepMl,
  )
  const current = clampRemainingToStart(
    currentRemainingMl,
    start,
    capacity,
    stepMl,
  )
  return stepMlValue(Math.max(0, start - current), capacity, stepMl)
}

/**
 * Position Y → ml bus en mode boire (plafond = niveau de départ).
 * Haut (départ) = 0 bus ; bas = startRemaining bus.
 */
export function drunkMlFromPointerY(
  clientY: number,
  fillRect: { top: number; height: number; bottom?: number },
  kind: WaterContainerKind,
  capacityMl: number,
  startRemainingMl?: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  const start =
    startRemainingMl == null
      ? capacity
      : stepMlValue(startRemainingMl, capacity, stepMl)
  const remaining = clampRemainingToStart(
    remainingMlFromPointerY(clientY, fillRect, kind, capacity, stepMl),
    start,
    capacity,
    stepMl,
  )
  return drunkMlFromStartAndCurrent(start, remaining, capacity, stepMl)
}

/** Alias : remaining depuis le pointeur. */
export function mlFromPointerY(
  clientY: number,
  fillRect: { top: number; height: number; bottom?: number },
  kind: WaterContainerKind,
  capacityMl: number,
  stepMl: number = WATER_LEVEL_STEP_ML,
): number {
  return remainingMlFromPointerY(clientY, fillRect, kind, capacityMl, stepMl)
}

/** Position CSS `bottom` (%) de la poignée / ménisque (selon fillRatio remaining). */
export function handleBottomPercent(
  kind: WaterContainerKind,
  fillRatio: number,
): number {
  return Math.round(waterSurfaceFromBottom(kind, fillRatio) * 1000) / 10
}
