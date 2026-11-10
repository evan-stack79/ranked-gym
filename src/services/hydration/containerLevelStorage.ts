/**
 * Niveau restant mémorisé par contenant — persistant, scopé utilisateur.
 * Ne compte pas comme bu ; mis à jour après ajout (relâchement).
 */

import {
  WATER_LEVEL_STEP_ML,
  type WaterContainerKind,
} from '../../../shared/hydration/waterLevel'

export const CONTAINER_LEVEL_STORAGE_KEY = 'ranked-gym:hydration-container-level'

type LevelMap = Partial<Record<WaterContainerKind, number>>
/** userId → map contenants ; `__anon__` si hors session. */
type UserLevelStore = Record<string, LevelMap>

const ANON_KEY = '__anon__'

let activeUserId: string | null = null

function stepClamp(ml: number, capacityMl: number): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const stepped = Math.round(ml / WATER_LEVEL_STEP_ML) * WATER_LEVEL_STEP_ML
  return Math.min(capacity, Math.max(0, stepped))
}

function userKey(userId?: string | null): string {
  if (userId != null && userId !== '') return userId
  if (activeUserId != null && activeUserId !== '') return activeUserId
  return ANON_KEY
}

function readStore(): UserLevelStore {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(CONTAINER_LEVEL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    // Migration legacy : map plate kind→ml → under __anon__
    const obj = parsed as Record<string, unknown>
    const looksLegacy = Object.keys(obj).some((k) =>
      ['plastic_15', 'small_50', 'glass_25', 'gourd'].includes(k),
    )
    const looksNested = Object.values(obj).some(
      (v) => v && typeof v === 'object' && !Array.isArray(v),
    )
    if (looksLegacy && !looksNested) {
      return { [ANON_KEY]: obj as LevelMap }
    }
    return obj as UserLevelStore
  } catch {
    return {}
  }
}

function writeStore(store: UserLevelStore): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CONTAINER_LEVEL_STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota */
  }
}

function readMap(uid?: string | null): LevelMap {
  const store = readStore()
  return store[userKey(uid)] ?? {}
}

function writeMap(map: LevelMap, uid?: string | null): void {
  const store = readStore()
  store[userKey(uid)] = map
  writeStore(store)
}

/** À appeler au login / logout pour scoper la mémoire. */
export function setContainerLevelUserId(userId: string | null): void {
  activeUserId = userId
}

/** True si un niveau a déjà été enregistré pour ce contenant (pas le défaut plein). */
export function hasMemorizedRemainingMl(
  kind: WaterContainerKind,
  userId?: string | null,
): boolean {
  const stored = readMap(userId)[kind]
  return typeof stored === 'number' && Number.isFinite(stored)
}

/** Remaining mémorisé, sinon capacité (plein). */
export function getMemorizedRemainingMl(
  kind: WaterContainerKind,
  capacityMl: number,
  userId?: string | null,
): number {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return 0
  const stored = readMap(userId)[kind]
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return capacity
  return stepClamp(stored, capacity)
}

export function setMemorizedRemainingMl(
  kind: WaterContainerKind,
  remainingMl: number,
  capacityMl: number,
  userId?: string | null,
): void {
  const capacity =
    Number.isFinite(capacityMl) && capacityMl > 0 ? Math.round(capacityMl) : 0
  if (capacity <= 0) return
  const next = { ...readMap(userId), [kind]: stepClamp(remainingMl, capacity) }
  writeMap(next, userId)
}

export function clearMemorizedRemainingMl(
  kind?: WaterContainerKind,
  userId?: string | null,
): void {
  if (!kind) {
    const store = readStore()
    delete store[userKey(userId)]
    writeStore(store)
    return
  }
  const map = readMap(userId)
  delete map[kind]
  writeMap(map, userId)
}
