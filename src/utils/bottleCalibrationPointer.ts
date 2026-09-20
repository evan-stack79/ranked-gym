import { WATER_BOTTLE_CAPACITY_ML } from '../services/nutritionStorage'

export const BOTTLE_CALIBRATION_STEP_ML = 10
export const BOTTLE_CALIBRATION_KEYBOARD_STEP_ML = 50
export const CALIBRATION_KEYBOARD_STEP_ML = BOTTLE_CALIBRATION_KEYBOARD_STEP_ML
export const KEYBOARD_NUDGE_ML = BOTTLE_CALIBRATION_KEYBOARD_STEP_ML

export type BottleFillRect = {
  top: number
  height: number
  bottom?: number
}

function safeCapacity(capacityMl: number): number {
  return Number.isFinite(capacityMl) && capacityMl > 0
    ? capacityMl
    : WATER_BOTTLE_CAPACITY_ML
}

/** Arrondit au pas demandé et borne dans [0, capacité]. */
export function clampRemainingMl(
  ml: number,
  capacityMl: number = WATER_BOTTLE_CAPACITY_ML,
  stepMl: number = BOTTLE_CALIBRATION_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (!Number.isFinite(ml)) return 0
  const step = Number.isFinite(stepMl) && stepMl > 0 ? stepMl : 1
  const stepped = Math.round(ml / step) * step
  return Math.min(capacity, Math.max(0, stepped))
}

/**
 * Convertit la position Y du pointeur en ml restants, sans modifier le rectangle.
 * Le rectangle est la zone intérieure fixe, jamais la hauteur variable du liquide.
 */
export function remainingMlFromPointerY(
  clientY: number,
  fillRect: BottleFillRect,
  capacityMl: number = WATER_BOTTLE_CAPACITY_ML,
  stepMl: number = BOTTLE_CALIBRATION_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  const top = Number.isFinite(fillRect.top) ? fillRect.top : 0
  const validHeight = Number.isFinite(fillRect.height) && fillRect.height > 0
  if (!validHeight || !Number.isFinite(clientY)) return 0
  const height = fillRect.height
  const bottom = Number.isFinite(fillRect.bottom) ? fillRect.bottom! : top + height
  const progress = Math.min(1, Math.max(0, (bottom - clientY) / height))
  return clampRemainingMl(progress * capacity, capacity, stepMl)
}

/** Incrémente ou décrémente le niveau restant. */
export function nudgeRemainingMl(
  currentMl: number,
  deltaMl: number,
  capacityMl: number = WATER_BOTTLE_CAPACITY_ML,
  stepMl: number = BOTTLE_CALIBRATION_STEP_ML,
): number {
  return clampRemainingMl(currentMl + deltaMl, capacityMl, stepMl)
}

/** Résout toutes les touches clavier prévues par le slider. */
export function remainingMlFromKey(
  currentMl: number,
  key: string,
  capacityMl: number = WATER_BOTTLE_CAPACITY_ML,
): number | null {
  const capacity = safeCapacity(capacityMl)
  if (key === 'ArrowUp' || key === 'ArrowRight') {
    return nudgeRemainingMl(currentMl, BOTTLE_CALIBRATION_KEYBOARD_STEP_ML, capacity)
  }
  if (key === 'ArrowDown' || key === 'ArrowLeft') {
    return nudgeRemainingMl(currentMl, -BOTTLE_CALIBRATION_KEYBOARD_STEP_ML, capacity)
  }
  if (key === 'Home') return 0
  if (key === 'End') return capacity
  return null
}
