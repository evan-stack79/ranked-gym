/**
 * Niveau mémorisé par contenant (appareil local) — HY « niveau de départ ».
 * Ne compte pas comme bu ; mis à jour après « Ajouter ».
 */

import {
  WATER_LEVEL_STEP_ML,
  type WaterContainerKind,
} from '../../../shared/hydration/waterLevel'

export const CONTAINER_LEVEL_STORAGE_KEY = 'ranked-gym:hydration-container-level'

type LevelMap = Partial<Record<WaterContainerKind, number>>

function stepClamp(ml: number, capacityMl: number): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const stepped = Math.round(ml / WATER_LEVEL_STEP_ML) * WATER_LEVEL_STEP_ML
  return Math.min(capacity, Math.max(0, stepped))
}

function readMap(): LevelMap {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(CONTAINER_LEVEL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LevelMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeMap(map: LevelMap): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CONTAINER_LEVEL_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

/** Remaining mémorisé, sinon capacité (plein). */
export function getMemorizedRemainingMl(
  kind: WaterContainerKind,
  capacityMl: number,
): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const stored = readMap()[kind]
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return capacity
  return stepClamp(stored, capacity)
}

export function setMemorizedRemainingMl(
  kind: WaterContainerKind,
  remainingMl: number,
  capacityMl: number,
): void {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return
  const next = { ...readMap(), [kind]: stepClamp(remainingMl, capacity) }
  writeMap(next)
}

export function clearMemorizedRemainingMl(kind?: WaterContainerKind): void {
  if (!kind) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(CONTAINER_LEVEL_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
    return
  }
  const map = readMap()
  delete map[kind]
  writeMap(map)
}
