import { api as generatedApi } from '../../../convex/_generated/api'
import { getConvex } from '../../lib/convex'
import { getConvexSessionToken } from '../convexAuthService'
import {
  GLASS_ML,
  localDayKey,
  type HydrationEntrySource,
  type HydrationMode,
} from '../../shared/hydration'
import {
  enqueuePendingHydrationEntry,
  emitHydrationChanged,
  HYDRATION_CHANGED_EVENT,
  listPendingHydrationEntries,
  pendingDrunkMlForDay,
  removePendingHydrationEntry,
  type PendingHydrationEntry,
} from './hydrationOfflineQueue'

const api = generatedApi as any

export { HYDRATION_CHANGED_EVENT }

export type HydrationToday = {
  dayKey: string
  mode: HydrationMode
  goalMl: number
  drunkMl: number
  remainingMl: number
  showHighInfo: boolean
  myBottleVolumeMl: number | null
  myBottleHasShape: boolean
  proActive: boolean
  effectiveVisualMode: HydrationMode
  remindersEnabled: boolean
  reminderTimes: string[]
  canUndo: boolean
  lastEntryId: string | null
  glassMl: number
  classicBottleMl: number
  labelEauBueSeule: true
  /** Inclut file hors-ligne non confirmée. */
  pendingMl: number
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `hy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

function mergePending(today: HydrationToday, dayKey: string): HydrationToday {
  const pendingMl = pendingDrunkMlForDay(dayKey)
  const drunkMl = today.drunkMl + pendingMl
  return {
    ...today,
    drunkMl,
    remainingMl: Math.max(0, today.goalMl - drunkMl),
    showHighInfo: drunkMl >= 3000,
    pendingMl,
  }
}

const LOCAL_SETTINGS_KEY = 'ranked-gym:hydration-settings-cache'

type LocalSettingsCache = {
  mode: HydrationMode
  goalMl: number
  myBottleVolumeMl: number | null
  myBottleHasShape: boolean
  remindersEnabled: boolean
  reminderTimes: string[]
  proActive: boolean
}

function readLocalSettings(): LocalSettingsCache | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalSettingsCache
  } catch {
    return null
  }
}

function writeLocalSettings(cache: LocalSettingsCache): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

function fallbackToday(dayKey: string): HydrationToday {
  const cache = readLocalSettings()
  const goalMl = cache?.goalMl ?? 1500
  const pendingMl = pendingDrunkMlForDay(dayKey)
  const drunkMl = pendingMl
  const mode = cache?.mode ?? 'classic_2l'
  const proActive = cache?.proActive ?? false
  return {
    dayKey,
    mode,
    goalMl,
    drunkMl,
    remainingMl: Math.max(0, goalMl - drunkMl),
    showHighInfo: drunkMl >= 3000,
    myBottleVolumeMl: cache?.myBottleVolumeMl ?? null,
    myBottleHasShape: cache?.myBottleHasShape ?? false,
    proActive,
    effectiveVisualMode: mode === 'my_bottle' && !proActive ? 'classic_2l' : mode,
    remindersEnabled: cache?.remindersEnabled ?? false,
    reminderTimes: cache?.reminderTimes ?? ['10:00', '14:00', '18:00'],
    canUndo: listPendingHydrationEntries().some((e) => e.dayKey === dayKey),
    lastEntryId: null,
    glassMl: GLASS_ML,
    classicBottleMl: 2000,
    labelEauBueSeule: true,
    pendingMl,
  }
}

export async function fetchHydrationToday(dayKey = localDayKey()): Promise<HydrationToday> {
  try {
    const sessionToken = await requireToken()
    const today = (await getConvex().query(api.hydration.getToday, {
      sessionToken,
      dayKey,
    })) as Omit<HydrationToday, 'pendingMl'>
    writeLocalSettings({
      mode: today.mode,
      goalMl: today.goalMl,
      myBottleVolumeMl: today.myBottleVolumeMl,
      myBottleHasShape: today.myBottleHasShape,
      remindersEnabled: today.remindersEnabled,
      reminderTimes: today.reminderTimes,
      proActive: today.proActive,
    })
    return mergePending({ ...today, pendingMl: 0 }, dayKey)
  } catch {
    return fallbackToday(dayKey)
  }
}

export async function fetchHydrationHistory(
  endDayKey = localDayKey(),
): Promise<Array<{ dayKey: string; drunkMl: number }>> {
  const sessionToken = await requireToken()
  return getConvex().query(api.hydration.getHistory, { sessionToken, endDayKey })
}

export async function addHydrationEntry(input: {
  amountMl: number
  source: HydrationEntrySource
  dayKey?: string
  clientId?: string
}): Promise<HydrationToday> {
  const dayKey = input.dayKey ?? localDayKey()
  const clientId = input.clientId ?? newClientId()
  const pending: PendingHydrationEntry = {
    clientId,
    dayKey,
    amountMl: input.amountMl,
    source: input.source,
    createdAt: Date.now(),
  }
  enqueuePendingHydrationEntry(pending)
  emitHydrationChanged()

  try {
    const sessionToken = await requireToken()
    const result = (await getConvex().mutation(api.hydration.addEntry, {
      sessionToken,
      clientId,
      dayKey,
      amountMl: input.amountMl,
      source: input.source,
    })) as { today: Omit<HydrationToday, 'pendingMl'> }
    removePendingHydrationEntry(clientId)
    writeLocalSettings({
      mode: result.today.mode,
      goalMl: result.today.goalMl,
      myBottleVolumeMl: result.today.myBottleVolumeMl,
      myBottleHasShape: result.today.myBottleHasShape,
      remindersEnabled: result.today.remindersEnabled,
      reminderTimes: result.today.reminderTimes,
      proActive: result.today.proActive,
    })
    emitHydrationChanged()
    return mergePending({ ...result.today, pendingMl: 0 }, dayKey)
  } catch {
    // Garde l’entrée en file ; l’UI lit pending + cache.
    return fallbackToday(dayKey)
  }
}

export async function undoLastHydrationEntry(dayKey = localDayKey()): Promise<HydrationToday> {
  const pending = listPendingHydrationEntries().filter((e) => e.dayKey === dayKey)
  if (pending.length > 0) {
    pending.sort((a, b) => b.createdAt - a.createdAt)
    const last = pending[0]
    if (last) removePendingHydrationEntry(last.clientId)
    emitHydrationChanged()
    try {
      return await fetchHydrationToday(dayKey)
    } catch {
      return fallbackToday(dayKey)
    }
  }

  const sessionToken = await requireToken()
  const today = (await getConvex().mutation(api.hydration.undoLast, {
    sessionToken,
    dayKey,
  })) as Omit<HydrationToday, 'pendingMl'>
  emitHydrationChanged()
  return mergePending({ ...today, pendingMl: 0 }, dayKey)
}

export async function updateHydrationSettings(input: {
  mode?: HydrationMode
  goalMl?: number
  myBottleVolumeMl?: number
  remindersEnabled?: boolean
  reminderTimes?: string[]
  onboardedAt?: number
}) {
  const sessionToken = await requireToken()
  const result = await getConvex().mutation(api.hydration.updateSettings, {
    sessionToken,
    ...input,
  })
  const settings = result.settings as {
    mode: HydrationMode
    goalMl: number
    myBottleVolumeMl?: number
    myBottleHasShape: boolean
    remindersEnabled: boolean
    reminderTimes: string[]
  }
  writeLocalSettings({
    mode: settings.mode,
    goalMl: settings.goalMl,
    myBottleVolumeMl: settings.myBottleVolumeMl ?? null,
    myBottleHasShape: settings.myBottleHasShape,
    remindersEnabled: settings.remindersEnabled,
    reminderTimes: settings.reminderTimes,
    proActive: Boolean(result.proActive),
  })
  emitHydrationChanged()
  return result
}

export async function setBottleShapeFlag(hasShape: boolean) {
  const sessionToken = await requireToken()
  const result = await getConvex().mutation(api.hydration.setBottleShapeFlag, {
    sessionToken,
    hasShape,
  })
  emitHydrationChanged()
  return result
}

export async function deleteMyBottleRemote() {
  const sessionToken = await requireToken()
  const result = await getConvex().mutation(api.hydration.deleteMyBottle, { sessionToken })
  emitHydrationChanged()
  return result
}

/** Rejoue la file hors-ligne à la reconnexion. */
export async function flushHydrationPendingQueue(): Promise<number> {
  const pending = listPendingHydrationEntries()
  let flushed = 0
  for (const entry of pending) {
    try {
      const sessionToken = await requireToken()
      await getConvex().mutation(api.hydration.addEntry, {
        sessionToken,
        clientId: entry.clientId,
        dayKey: entry.dayKey,
        amountMl: entry.amountMl,
        source: entry.source,
      })
      removePendingHydrationEntry(entry.clientId)
      flushed += 1
    } catch {
      break
    }
  }
  if (flushed > 0) emitHydrationChanged()
  return flushed
}
