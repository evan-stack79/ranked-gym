export interface BottleCalibrationRect {
  top: number
  bottom: number
  height: number
}

export const BOTTLE_CALIBRATION_STEP_ML = 10
export const BOTTLE_CALIBRATION_KEYBOARD_STEP_ML = 50

function safeCapacity(capacityMl: number): number {
  return Number.isFinite(capacityMl) && capacityMl > 0 ? capacityMl : 1500
}

export function clampCalibrationRemainingMl(
  remainingMl: number,
  capacityMl = 1500,
  stepMl = BOTTLE_CALIBRATION_STEP_ML,
): number {
  const capacity = safeCapacity(capacityMl)
  if (!Number.isFinite(remainingMl)) return 0
  const step = Number.isFinite(stepMl) && stepMl > 0 ? stepMl : 1
  const stepped = Math.round(remainingMl / step) * step
  return Math.min(capacity, Math.max(0, stepped))
}

/**
 * Convertit la position verticale du doigt en liquide physiquement restant.
 * Le rectangle doit toujours être celui de l'intérieur fixe de la bouteille,
 * jamais celui du liquide dont la hauteur varie pendant le geste.
 */
export function calibrationRemainingMlFromPointer(
  clientY: number,
  rect: BottleCalibrationRect,
  capacityMl = 1500,
): number {
  const capacity = safeCapacity(capacityMl)
  const height = Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 1
  const bottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top + height
  const progress = Math.min(1, Math.max(0, (bottom - clientY) / height))
  return clampCalibrationRemainingMl(progress * capacity, capacity)
}

export function calibrationRemainingMlFromKey(
  currentMl: number,
  key: string,
  capacityMl = 1500,
): number | null {
  const capacity = safeCapacity(capacityMl)
  const current = clampCalibrationRemainingMl(currentMl, capacity)

  if (key === 'ArrowUp' || key === 'ArrowRight') {
    return clampCalibrationRemainingMl(
      current + BOTTLE_CALIBRATION_KEYBOARD_STEP_ML,
      capacity,
    )
  }
  if (key === 'ArrowDown' || key === 'ArrowLeft') {
    return clampCalibrationRemainingMl(
      current - BOTTLE_CALIBRATION_KEYBOARD_STEP_ML,
      capacity,
    )
  }
  if (key === 'Home') return 0
  if (key === 'End') return capacity
  return null
}
