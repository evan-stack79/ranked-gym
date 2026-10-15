import type { DayJournal, MealEntry, WaterEntry } from '../types/nutrition'
import { getActiveCloudUserId } from './cloudSession'
import {
  deleteConvexMeal,
  deleteConvexWaterEntry,
  pushConvexDayState,
  pushConvexMeal,
  pushConvexWaterEntry,
} from './convexNutritionService'
import { readFoodAddErrorData } from './alimentsService'
import { getJournalForDate, saveJournalForDate } from './nutritionStorage'
import { safeError, safeWarn } from '../utils/safeLog'

type MealUpsertOp = {
  kind: 'meal-upsert'
  dateKey: string
  meal: MealEntry
  updatedAt: number
}

type MealDeleteOp = {
  kind: 'meal-delete'
  dateKey: string
  mealId: string
  deletedAt: number
}

type WaterUpsertOp = {
  kind: 'water-upsert'
  dateKey: string
  entry: WaterEntry
  updatedAt: number
}

type WaterDeleteOp = {
  kind: 'water-delete'
  dateKey: string
  entryId: string
  deletedAt: number
}

type DayStateOp = {
  kind: 'day-state-upsert'
  dateKey: string
  dayState: Pick<DayJournal, 'waterBottleLevelMl' | 'waterBottleCalibrationTotalMl'>
  updatedAt: number
}

export type NutritionQueueOp = MealUpsertOp | MealDeleteOp | WaterUpsertOp | WaterDeleteOp | DayStateOp

type StoredQueueOp = NutritionQueueOp & {
  id: string
  enqueuedAt: number
  /** Tentatives pour backoff erreur passagère. */
  attempts?: number
  nextAttemptAt?: number
}

export type RejectedQueueEntry = {
  opId: string
  kind: NutritionQueueOp['kind']
  code: string
  rejectedAt: number
  dateKey?: string
  mealId?: string
}

let flushInFlight: Promise<void> | null = null
let lifecycleWired = false

function queueKey(userId: string): string {
  return `ranked-gym:convex-nutrition-queue:u:${userId}`
}

function rejectedKey(userId: string): string {
  return `ranked-gym:convex-nutrition-rejected:u:${userId}`
}

function makeOperationId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readQueue(userId: string): StoredQueueOp[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(queueKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredQueueOp[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeQueue(userId: string, entries: StoredQueueOp[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(entries))
  } catch (error) {
    safeWarn('[nutrition-sync] queue write failed', error)
  }
}

function readRejected(userId: string): RejectedQueueEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(rejectedKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as RejectedQueueEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRejected(userId: string, entries: RejectedQueueEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(rejectedKey(userId), JSON.stringify(entries))
  } catch (error) {
    safeWarn('[nutrition-sync] rejected write failed', error)
  }
}

function removeQueueOpById(entries: StoredQueueOp[], opId: string): StoredQueueOp[] {
  const index = entries.findIndex((entry) => entry.id === opId)
  if (index < 0) return entries
  return [...entries.slice(0, index), ...entries.slice(index + 1)]
}

/**
 * Codes Convex connus = refus définitif (sortie file → refusés).
 * FOOD_ADD_ACCESS_AGE_REQUIRED / age_required = passager (l’âge peut être
 * complété) — reste en file, backoff, pas « Pas enregistré ».
 */
export function isPermanentConvexQueueError(error: unknown): boolean {
  const data = readFoodAddErrorData(error)
  const code = data?.code
  if (!code) return false
  if (code === 'age_required' || code === 'FOOD_ADD_ACCESS_AGE_REQUIRED') {
    return false
  }
  if (code.startsWith('FOOD_ADD_')) return true
  if (code === 'FOOD_SEARCH_DAILY_LIMIT') return true
  return false
}

export function permanentConvexErrorCode(error: unknown): string | null {
  const data = readFoodAddErrorData(error)
  return data?.code ?? null
}

function markMealSyncRejected(dateKey: string, mealId: string, code: string): void {
  try {
    const journal = getJournalForDate(dateKey)
    const next = {
      ...journal,
      meals: journal.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              syncRejected: true,
              syncRejectCode: code,
              syncRejectedAt: Date.now(),
            }
          : m,
      ),
    }
    saveJournalForDate(next, { skipCloud: true })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ranked-gym:profile-changed'))
    }
  } catch (error) {
    safeWarn('[nutrition-sync] mark syncRejected failed', error)
  }
}

/** B3-06 : envoi réussi → effacer la marque « Pas enregistré ». */
function clearMealSyncRejected(dateKey: string, mealId: string): void {
  try {
    const journal = getJournalForDate(dateKey)
    let changed = false
    const meals = journal.meals.map((m) => {
      if (m.id !== mealId || !m.syncRejected) return m
      changed = true
      const { syncRejected: _a, syncRejectCode: _b, syncRejectedAt: _c, ...rest } = m
      void _a
      void _b
      void _c
      return rest
    })
    if (!changed) return
    saveJournalForDate({ ...journal, meals }, { skipCloud: true })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ranked-gym:profile-changed'))
    }
  } catch (error) {
    safeWarn('[nutrition-sync] clear syncRejected failed', error)
  }
}

const REJECTED_QUEUE_MAX = 50

async function applyQueueOperation(op: StoredQueueOp): Promise<void> {
  switch (op.kind) {
    case 'meal-upsert':
      await pushConvexMeal(op.meal, op.dateKey, op.updatedAt)
      return
    case 'meal-delete':
      await deleteConvexMeal(op.mealId, op.dateKey, op.deletedAt)
      return
    case 'water-upsert':
      await pushConvexWaterEntry(op.entry, op.dateKey, op.updatedAt)
      return
    case 'water-delete':
      await deleteConvexWaterEntry(op.entryId, op.dateKey, op.deletedAt)
      return
    case 'day-state-upsert':
      await pushConvexDayState(op.dateKey, op.dayState, op.updatedAt)
      return
  }
}

function wireQueueLifecycleOnce() {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true
  const trigger = () => {
    void flushConvexNutritionQueue()
  }
  window.addEventListener('online', trigger)
  window.addEventListener('focus', trigger)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trigger()
  })
}

export function enqueueConvexNutritionOp(op: NutritionQueueOp): void {
  const userId = getActiveCloudUserId()
  if (!userId) return
  wireQueueLifecycleOnce()
  const queue = readQueue(userId)
  queue.push({
    ...op,
    id: makeOperationId(op.kind),
    enqueuedAt: Date.now(),
    attempts: 0,
  })
  writeQueue(userId, queue)
  void flushConvexNutritionQueue()
}

export async function flushConvexNutritionQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight
  const userId = getActiveCloudUserId()
  if (!userId) return
  let flushAbortedForFailure = false
  flushInFlight = (async () => {
    while (true) {
      const queue = readQueue(userId)
      if (queue.length === 0) return
      const current = queue[0]!
      if (current.nextAttemptAt && current.nextAttemptAt > Date.now()) {
        flushAbortedForFailure = true
        break
      }
      try {
        await applyQueueOperation(current)
        if (current.kind === 'meal-upsert') {
          clearMealSyncRejected(current.dateKey, current.meal.id)
        }
        const latestQueue = readQueue(userId)
        const nextQueue = removeQueueOpById(latestQueue, current.id)
        writeQueue(userId, nextQueue)
      } catch (error) {
        safeError('[nutrition-sync] convex op failed', {
          kind: current.kind,
          message: error instanceof Error ? error.message : String(error),
        })
        if (isPermanentConvexQueueError(error)) {
          const code = permanentConvexErrorCode(error) ?? 'UNKNOWN'
          const rejected = readRejected(userId)
          rejected.push({
            opId: current.id,
            kind: current.kind,
            code,
            rejectedAt: Date.now(),
            dateKey: 'dateKey' in current ? current.dateKey : undefined,
            mealId:
              current.kind === 'meal-upsert'
                ? current.meal.id
                : current.kind === 'meal-delete'
                  ? current.mealId
                  : undefined,
          })
          // B3-06 : garder seulement les 50 derniers refus.
          writeRejected(userId, rejected.slice(-REJECTED_QUEUE_MAX))
          if (current.kind === 'meal-upsert') {
            markMealSyncRejected(current.dateKey, current.meal.id, code)
          }
          const latestQueue = readQueue(userId)
          writeQueue(userId, removeQueueOpById(latestQueue, current.id))
          // Suite continue tout de suite.
          continue
        }
        // Erreur passagère : garder, backoff, stop ce tour.
        const attempts = (current.attempts ?? 0) + 1
        const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 5))
        const latestQueue = readQueue(userId)
        const idx = latestQueue.findIndex((e) => e.id === current.id)
        if (idx >= 0) {
          latestQueue[idx] = {
            ...latestQueue[idx]!,
            attempts,
            nextAttemptAt: Date.now() + delayMs,
          }
          writeQueue(userId, latestQueue)
        }
        flushAbortedForFailure = true
        break
      }
    }
  })()
  try {
    await flushInFlight
  } finally {
    flushInFlight = null
  }

  if (!flushAbortedForFailure && readQueue(userId).length > 0) {
    await flushConvexNutritionQueue()
  }
}

export function getQueuedConvexNutritionOpCount(): number {
  const userId = getActiveCloudUserId()
  if (!userId) return 0
  return readQueue(userId).length
}

export function clearQueuedConvexNutritionOpsForUser(userId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(queueKey(userId))
  } catch {
    // ignore
  }
}

/** Retire uniquement les ops repas (upsert/delete) — garde eau / day-state. */
export function clearQueuedMealOpsForUser(userId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const kept = readQueue(userId).filter(
      (op) => op.kind !== 'meal-upsert' && op.kind !== 'meal-delete',
    )
    writeQueue(userId, kept)
  } catch {
    // ignore
  }
}

/** Compte les ops repas en attente (tests / UI). */
export function countQueuedMealOpsForUser(userId: string): number {
  return readQueue(userId).filter(
    (op) => op.kind === 'meal-upsert' || op.kind === 'meal-delete',
  ).length
}

/** Ids des repas avec upsert encore en file (pas encore envoyés). */
export function pendingMealUpsertIdsForUser(userId: string): Set<string> {
  const ids = new Set<string>()
  for (const op of readQueue(userId)) {
    if (op.kind === 'meal-upsert' && op.meal?.id) ids.add(op.meal.id)
  }
  return ids
}

/** Exposé tests : lire la file. */
export function __testReadNutritionQueue(userId: string): StoredQueueOp[] {
  return readQueue(userId)
}

/** Exposé tests : lire les refusés. */
export function __testReadRejectedQueue(userId: string): RejectedQueueEntry[] {
  return readRejected(userId)
}

/** Exposé tests : écrire la file (setup). */
export function __testWriteNutritionQueue(userId: string, entries: StoredQueueOp[]): void {
  writeQueue(userId, entries)
}
