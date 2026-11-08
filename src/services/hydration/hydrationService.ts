import { api as generatedApi } from '../../../convex/_generated/api'
import { getConvex } from '../../lib/convex'
import { getConvexSessionToken } from '../convexAuthService'
import {
  ENTRY_MAX_ML,
  ENTRY_MIN_ML,
  GLASS_ML,
  GOAL_DEFAULT_ML,
  isDayKeyWithinTolerance,
  isValidDayKey,
  localDayKey,
  type HydrationEntrySource,
  type HydrationMode,
} from '../../shared/hydration'
import {
  bindHydrationQueueUser,
  clearHydrationOfflineQueue,
  enqueuePendingHydrationEntry,
  emitHydrationChanged,
  getHydrationQueueUserId,
  HYDRATION_CHANGED_EVENT,
  listPendingHydrationEntries,
  pendingDrunkMlForDay,
  removePendingHydrationEntry,
  type PendingHydrationEntry,
} from './hydrationOfflineQueue'
import {
  pauseHydrationRemindersIfGoalReached,
  syncHydrationReminders,
} from './hydrationReminders'

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
  /** Total serveur confirmé (sans pending). */
  confirmedMl: number
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

const LOCAL_CACHE_KEY = 'ranked-gym:hydration-settings-cache'

type LocalSettingsCache = {
  userId: string | null
  mode: HydrationMode
  goalMl: number
  myBottleVolumeMl: number | null
  myBottleHasShape: boolean
  remindersEnabled: boolean
  reminderTimes: string[]
  proActive: boolean
  /** M4 — totaux confirmés par dayKey. */
  confirmedByDay: Record<string, number>
}

function readLocalSettings(): LocalSettingsCache | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalSettingsCache
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.confirmedByDay || typeof parsed.confirmedByDay !== 'object') {
      parsed.confirmedByDay = {}
    }
    return parsed
  } catch {
    return null
  }
}

function writeLocalSettings(cache: LocalSettingsCache): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

function cacheFromToday(
  today: Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>,
  userId: string | null,
  dayKey: string,
): LocalSettingsCache {
  const prev = readLocalSettings()
  const confirmedByDay = { ...(prev?.userId === userId ? prev.confirmedByDay : {}) }
  confirmedByDay[dayKey] = today.drunkMl
  return {
    userId,
    mode: today.mode,
    goalMl: today.goalMl,
    myBottleVolumeMl: today.myBottleVolumeMl,
    myBottleHasShape: today.myBottleHasShape,
    remindersEnabled: today.remindersEnabled,
    reminderTimes: today.reminderTimes,
    proActive: today.proActive,
    confirmedByDay,
  }
}

function mergePending(
  today: Omit<HydrationToday, 'pendingMl' | 'confirmedMl'> & { pendingMl?: number },
  dayKey: string,
  userId?: string | null,
): HydrationToday {
  const pendingMl = pendingDrunkMlForDay(dayKey, userId)
  const confirmedMl = today.drunkMl
  const drunkMl = confirmedMl + pendingMl
  return {
    ...today,
    drunkMl,
    remainingMl: Math.max(0, today.goalMl - drunkMl),
    showHighInfo: drunkMl >= 3000,
    pendingMl,
    confirmedMl,
  }
}

function fallbackToday(dayKey: string, userId?: string | null): HydrationToday {
  const uid = userId ?? getHydrationQueueUserId()
  const cache = readLocalSettings()
  const cacheOk = cache != null && (uid == null || cache.userId == null || cache.userId === uid)
  const goalMl = cacheOk ? (cache?.goalMl ?? GOAL_DEFAULT_ML) : GOAL_DEFAULT_ML
  const confirmedMl = cacheOk ? (cache?.confirmedByDay?.[dayKey] ?? 0) : 0
  const pendingMl = pendingDrunkMlForDay(dayKey, uid)
  const drunkMl = confirmedMl + pendingMl
  const mode = cacheOk ? (cache?.mode ?? 'classic_2l') : 'classic_2l'
  const proActive = cacheOk ? (cache?.proActive ?? false) : false
  return {
    dayKey,
    mode,
    goalMl,
    drunkMl,
    remainingMl: Math.max(0, goalMl - drunkMl),
    showHighInfo: drunkMl >= 3000,
    myBottleVolumeMl: cacheOk ? (cache?.myBottleVolumeMl ?? null) : null,
    myBottleHasShape: cacheOk ? (cache?.myBottleHasShape ?? false) : false,
    proActive,
    effectiveVisualMode: mode === 'my_bottle' && !proActive ? 'classic_2l' : mode,
    remindersEnabled: cacheOk ? (cache?.remindersEnabled ?? false) : false,
    reminderTimes: cacheOk
      ? (cache?.reminderTimes ?? ['10:00', '14:00', '18:00'])
      : ['10:00', '14:00', '18:00'],
    canUndo: listPendingHydrationEntries(uid).some((e) => e.dayKey === dayKey),
    lastEntryId: null,
    glassMl: GLASS_ML,
    classicBottleMl: 2000,
    labelEauBueSeule: true,
    pendingMl,
    confirmedMl,
  }
}

async function maybePauseReminders(today: HydrationToday): Promise<void> {
  await pauseHydrationRemindersIfGoalReached({
    remindersEnabled: today.remindersEnabled,
    reminderTimes: today.reminderTimes,
    drunkMl: today.drunkMl,
    goalMl: today.goalMl,
  })
}

function resolveActiveUserId(): string | null {
  try {
    // Prefer queue binding; AuthContext / sign-in should call bindHydrationQueueUser.
    return getHydrationQueueUserId()
  } catch {
    return null
  }
}

export function clearHydrationLocalState(): void {
  const prev = getHydrationQueueUserId()
  clearHydrationOfflineQueue()
  bindHydrationQueueUser(null)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_CACHE_KEY)
    }
  } catch {
    /* ignore */
  }
  if (prev) {
    void import('./hydrationLegacyMigrate').then((m) => m.clearLocalLegacyMigrateFlag(prev))
  }
  emitHydrationChanged()
}

/** À appeler au login / switch compte (M5). */
export function onHydrationAccountChanged(userId: string | null): void {
  const prev = getHydrationQueueUserId()
  if (userId == null) {
    clearHydrationLocalState()
    return
  }
  if (prev != null && prev !== userId) {
    clearHydrationOfflineQueue()
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(LOCAL_CACHE_KEY)
    } catch {
      /* ignore */
    }
  }
  bindHydrationQueueUser(userId)
}

export async function fetchHydrationToday(dayKey = localDayKey()): Promise<HydrationToday> {
  const userId = resolveActiveUserId()
  try {
    const sessionToken = await requireToken()
    // M1 — migration serveur idempotente (nutrition_water_entries → hydration*).
    try {
      await getConvex().mutation(api.hydration.migrateLegacyWater, {
        sessionToken,
        endDayKey: dayKey,
      })
    } catch {
      /* query-only fallback si mutation indisponible */
    }
    // M1 — journal local (même clientId legacy:*) pour ne pas perdre 1200 ml hors sync.
    if (userId) {
      try {
        const { migrateLocalLegacyWaterToHydration } = await import('./hydrationLegacyMigrate')
        await migrateLocalLegacyWaterToHydration(userId, dayKey)
      } catch {
        /* ignore */
      }
    }
    const today = (await getConvex().query(api.hydration.getToday, {
      sessionToken,
      dayKey,
    })) as Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>
    writeLocalSettings(cacheFromToday(today, userId, dayKey))
    const merged = mergePending(today, dayKey, userId)
    // M2 — réarmement lendemain : pause objectif = jour J seulement.
    // Au refresh (focus / nouveau jour), sync avec goalReachedToday du jour courant.
    if (merged.remindersEnabled) {
      try {
        await syncHydrationReminders({
          enabled: true,
          times: merged.reminderTimes,
          goalReachedToday: merged.drunkMl >= merged.goalMl,
        })
      } catch {
        /* web / plugin : ignore */
      }
    }
    return merged
  } catch {
    return fallbackToday(dayKey, userId)
  }
}

export async function fetchHydrationHistory(
  endDayKey = localDayKey(),
): Promise<Array<{ dayKey: string; drunkMl: number }>> {
  const sessionToken = await requireToken()
  return getConvex().query(api.hydration.getHistory, { sessionToken, endDayKey })
}

function isValidAmountClient(amountMl: number): boolean {
  return (
    Number.isFinite(amountMl)
    && Number.isInteger(amountMl)
    && amountMl >= ENTRY_MIN_ML
    && amountMl <= ENTRY_MAX_ML
  )
}

export async function addHydrationEntry(input: {
  amountMl: number
  source: HydrationEntrySource
  dayKey?: string
  clientId?: string
  userId?: string | null
}): Promise<HydrationToday> {
  const dayKey = input.dayKey ?? localDayKey()
  const userId = input.userId ?? resolveActiveUserId()
  if (!userId) {
    // Sans compte lié : pas de file (évite poison multi-compte).
    throw new Error('HYDRATION_USER_REQUIRED')
  }
  if (!isValidAmountClient(input.amountMl) || !isValidDayKey(dayKey)) {
    throw new Error('HYDRATION_INVALID_ENTRY')
  }

  const clientId = input.clientId ?? newClientId()
  const pending: PendingHydrationEntry = {
    userId,
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
    })) as { today: Omit<HydrationToday, 'pendingMl' | 'confirmedMl'> }
    removePendingHydrationEntry(clientId, userId)
    writeLocalSettings(cacheFromToday(result.today, userId, dayKey))
    const merged = mergePending(result.today, dayKey, userId)
    await maybePauseReminders(merged)
    emitHydrationChanged()
    return merged
  } catch {
    const offline = fallbackToday(dayKey, userId)
    await maybePauseReminders(offline)
    return offline
  }
}

export async function undoLastHydrationEntry(dayKey = localDayKey()): Promise<HydrationToday> {
  const userId = resolveActiveUserId()
  const pending = listPendingHydrationEntries(userId).filter((e) => e.dayKey === dayKey)
  if (pending.length > 0) {
    pending.sort((a, b) => b.createdAt - a.createdAt)
    const last = pending[0]
    if (last) removePendingHydrationEntry(last.clientId, userId)
    emitHydrationChanged()
    try {
      return await fetchHydrationToday(dayKey)
    } catch {
      return fallbackToday(dayKey, userId)
    }
  }

  const sessionToken = await requireToken()
  const today = (await getConvex().mutation(api.hydration.undoLast, {
    sessionToken,
    dayKey,
  })) as Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>
  writeLocalSettings(cacheFromToday(today, userId, dayKey))
  emitHydrationChanged()
  return mergePending(today, dayKey, userId)
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
  const userId = resolveActiveUserId()
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
  const prev = readLocalSettings()
  writeLocalSettings({
    userId,
    mode: settings.mode,
    goalMl: settings.goalMl,
    myBottleVolumeMl: settings.myBottleVolumeMl ?? null,
    myBottleHasShape: settings.myBottleHasShape,
    remindersEnabled: settings.remindersEnabled,
    reminderTimes: settings.reminderTimes,
    proActive: Boolean(result.proActive),
    confirmedByDay: prev?.userId === userId ? (prev.confirmedByDay ?? {}) : {},
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

function isPermanentReject(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return (
    msg.includes('HYDRATION_INVALID_DAY_KEY')
    || msg.includes('HYDRATION_AMOUNT_OUT_OF_RANGE')
    || msg.includes('HYDRATION_INVALID_CLIENT_ID')
    || msg.includes('HYDRATION_INVALID_SOURCE')
    || msg.includes('HYDRATION_INVALID_ENTRY')
  )
}

/** Rejoue la file hors-ligne à la reconnexion (M5/M6). */
export async function flushHydrationPendingQueue(): Promise<number> {
  const userId = resolveActiveUserId()
  if (!userId) return 0
  const pending = listPendingHydrationEntries(userId)
  let flushed = 0
  for (const entry of pending) {
    // M6 — entrée trop vieille : écarter sans bloquer la suite.
    if (!isValidDayKey(entry.dayKey) || !isDayKeyWithinTolerance(entry.dayKey)) {
      removePendingHydrationEntry(entry.clientId, userId)
      continue
    }
    if (!isValidAmountClient(entry.amountMl)) {
      removePendingHydrationEntry(entry.clientId, userId)
      continue
    }
    try {
      const sessionToken = await requireToken()
      await getConvex().mutation(api.hydration.addEntry, {
        sessionToken,
        clientId: entry.clientId,
        dayKey: entry.dayKey,
        amountMl: entry.amountMl,
        source: entry.source,
      })
      removePendingHydrationEntry(entry.clientId, userId)
      flushed += 1
    } catch (error) {
      if (isPermanentReject(error)) {
        removePendingHydrationEntry(entry.clientId, userId)
        continue
      }
      break
    }
  }
  if (flushed > 0) {
    try {
      const today = await fetchHydrationToday(localDayKey())
      await maybePauseReminders(today)
    } catch {
      /* ignore */
    }
    emitHydrationChanged()
  }
  return flushed
}
