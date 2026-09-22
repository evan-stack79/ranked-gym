import type { DayJournal, MealEntry, WaterEntry } from '../types/nutrition'
import { getActiveCloudUserId } from './cloudSession'
import {
  deleteConvexMeal,
  deleteConvexWaterEntry,
  pushConvexDayState,
  pushConvexMeal,
  pushConvexWaterEntry,
} from './convexNutritionService'
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
}

let flushInFlight: Promise<void> | null = null
let lifecycleWired = false

function queueKey(userId: string): string {
  return `ranked-gym:convex-nutrition-queue:u:${userId}`
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

function removeQueueOpById(entries: StoredQueueOp[], opId: string): StoredQueueOp[] {
  const index = entries.findIndex((entry) => entry.id === opId)
  if (index < 0) return entries
  return [...entries.slice(0, index), ...entries.slice(index + 1)]
}

function isConvexTemporaryFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('temporarily') ||
    lower.includes('convex') ||
    lower.includes('connection')
  )
}

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

async function requestSupabaseFallbackPush() {
  try {
    const { notifyLocalDataChanged } = await import('./cloudBackup')
    notifyLocalDataChanged()
  } catch (error) {
    safeWarn('[nutrition-sync] fallback push unavailable', error)
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
      const current = queue[0]
      try {
        await applyQueueOperation(current)
        const latestQueue = readQueue(userId)
        const nextQueue = removeQueueOpById(latestQueue, current.id)
        writeQueue(userId, nextQueue)
      } catch (error) {
        safeError('[nutrition-sync] convex op failed', {
          kind: current.kind,
          message: error instanceof Error ? error.message : String(error),
        })
        if (isConvexTemporaryFailure(error)) {
          await requestSupabaseFallbackPush()
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

  // A new enqueue can happen while a flush is unwinding; run once more if needed.
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
