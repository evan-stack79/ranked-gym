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
  lastNDayKeys,
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
const PENDING_SETTINGS_KEY = 'ranked-gym:hydration-settings-pending'
const LOCAL_DELETED_KEY = 'ranked-gym:hydration-deleted-entries'

export type HydrationDayEntry = {
  clientId: string
  amountMl: number
  createdAt: number
  source: string
  /** true = seulement en file locale / pas encore confirmé serveur. */
  pending?: boolean
}

type LocalDeletedEntry = {
  clientId: string
  dayKey: string
  amountMl: number
  deletedAt: number
  /** false tant que Convex deleteEntry n’a pas confirmé. */
  synced?: boolean
}

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

/** Patch local non encore accepté par Convex (ex. classic_15 avant deploy). */
export type PendingHydrationSettings = {
  mode?: HydrationMode
  goalMl?: number
  myBottleVolumeMl?: number
  remindersEnabled?: boolean
  reminderTimes?: string[]
  onboardedAt?: number
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

export function readPendingHydrationSettings(): PendingHydrationSettings | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(PENDING_SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingHydrationSettings
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writePendingHydrationSettings(pending: PendingHydrationSettings | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (pending == null || Object.keys(pending).length === 0) {
      localStorage.removeItem(PENDING_SETTINGS_KEY)
      return
    }
    localStorage.setItem(PENDING_SETTINGS_KEY, JSON.stringify(pending))
  } catch {
    /* ignore */
  }
}

function readLocalDeleted(): LocalDeletedEntry[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(LOCAL_DELETED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalDeletedEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalDeleted(rows: LocalDeletedEntry[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

/** ml à retirer du total serveur tant que deleteEntry n’est pas sync. */
export function localDeletedMlForDay(dayKey: string): number {
  return readLocalDeleted()
    .filter((d) => d.dayKey === dayKey && d.synced !== true)
    .reduce((sum, d) => sum + Math.max(0, Math.round(d.amountMl)), 0)
}

export function isLocallyDeletedClientId(clientId: string, dayKey: string): boolean {
  return readLocalDeleted().some((d) => d.clientId === clientId && d.dayKey === dayKey)
}

function overlayPendingOnToday(
  today: Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>,
  pending: PendingHydrationSettings | null,
): Omit<HydrationToday, 'pendingMl' | 'confirmedMl'> {
  if (!pending) return today
  const mode = pending.mode ?? today.mode
  const goalMl = pending.goalMl ?? today.goalMl
  const myBottleVolumeMl =
    pending.myBottleVolumeMl !== undefined
      ? pending.myBottleVolumeMl
      : today.myBottleVolumeMl
  return {
    ...today,
    mode,
    goalMl,
    myBottleVolumeMl,
    remindersEnabled: pending.remindersEnabled ?? today.remindersEnabled,
    reminderTimes: pending.reminderTimes ?? today.reminderTimes,
    remainingMl: Math.max(0, goalMl - today.drunkMl),
    effectiveVisualMode:
      mode === 'my_bottle' && !today.proActive ? 'classic_2l' : mode,
  }
}

/** Applique un patch réglages en local (cache + pending) et notifie les cartes. */
export function applyHydrationSettingsLocal(
  patch: PendingHydrationSettings,
  userId?: string | null,
): LocalSettingsCache {
  const uid = userId ?? resolveActiveUserId()
  const prev = readLocalSettings()
  const next: LocalSettingsCache = {
    userId: uid,
    mode: patch.mode ?? prev?.mode ?? 'classic_2l',
    goalMl: patch.goalMl ?? prev?.goalMl ?? GOAL_DEFAULT_ML,
    myBottleVolumeMl:
      patch.myBottleVolumeMl !== undefined
        ? patch.myBottleVolumeMl
        : (prev?.myBottleVolumeMl ?? null),
    myBottleHasShape: prev?.myBottleHasShape ?? false,
    remindersEnabled: patch.remindersEnabled ?? prev?.remindersEnabled ?? false,
    reminderTimes: patch.reminderTimes ?? prev?.reminderTimes ?? ['10:00', '14:00', '18:00'],
    proActive: prev?.proActive ?? false,
    confirmedByDay: prev?.userId === uid ? (prev.confirmedByDay ?? {}) : {},
  }
  writeLocalSettings(next)
  const existing = readPendingHydrationSettings() ?? {}
  writePendingHydrationSettings({ ...existing, ...patch })
  emitHydrationChanged()
  return next
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
  const deletedMl = localDeletedMlForDay(dayKey)
  const confirmedMl = Math.max(0, today.drunkMl - deletedMl)
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

/** Snapshot local (tests + repli fetch). */
export function fallbackToday(dayKey: string, userId?: string | null): HydrationToday {
  const uid = userId ?? getHydrationQueueUserId()
  const cache = readLocalSettings()
  const cacheOk = cache != null && (uid == null || cache.userId == null || cache.userId === uid)
  const goalMl = cacheOk ? (cache?.goalMl ?? GOAL_DEFAULT_ML) : GOAL_DEFAULT_ML
  const rawConfirmed = cacheOk ? (cache?.confirmedByDay?.[dayKey] ?? 0) : 0
  const confirmedMl = Math.max(0, rawConfirmed - localDeletedMlForDay(dayKey))
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
      localStorage.removeItem(PENDING_SETTINGS_KEY)
      localStorage.removeItem(LOCAL_DELETED_KEY)
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
  void import('./containerLevelStorage').then((m) => {
    m.setContainerLevelUserId(userId)
  })
  if (userId == null) {
    clearHydrationLocalState()
    return
  }
  if (prev != null && prev !== userId) {
    clearHydrationOfflineQueue()
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_CACHE_KEY)
        localStorage.removeItem(PENDING_SETTINGS_KEY)
        localStorage.removeItem(LOCAL_DELETED_KEY)
      }
    } catch {
      /* ignore */
    }
  }
  bindHydrationQueueUser(userId)
  void flushPendingHydrationSettings()
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
    const remote = (await getConvex().query(api.hydration.getToday, {
      sessionToken,
      dayKey,
    })) as Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>
    // Ne jamais écraser un choix local optimiste (ex. classic_15 refusé en prod).
    const pending = readPendingHydrationSettings()
    const today = overlayPendingOnToday(remote, pending)
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

/** Repli local (cache confirmé + file pending) — même esprit que fetchHydrationToday. */
export function fallbackHydrationHistory(
  endDayKey = localDayKey(),
  userId?: string | null,
): Array<{ dayKey: string; drunkMl: number }> {
  const uid = userId ?? getHydrationQueueUserId()
  const cache = readLocalSettings()
  const cacheOk = cache != null && (uid == null || cache.userId == null || cache.userId === uid)
  return lastNDayKeys(endDayKey, 7).map((dayKey) => {
    const confirmed = cacheOk ? (cache?.confirmedByDay?.[dayKey] ?? 0) : 0
    const pending = pendingDrunkMlForDay(dayKey, uid)
    return {
      dayKey,
      drunkMl: Math.max(0, confirmed + pending - localDeletedMlForDay(dayKey)),
    }
  })
}

export async function fetchHydrationHistory(
  endDayKey = localDayKey(),
): Promise<Array<{ dayKey: string; drunkMl: number }>> {
  const userId = resolveActiveUserId()
  try {
    const sessionToken = await requireToken()
    const rows = (await getConvex().query(api.hydration.getHistory, {
      sessionToken,
      endDayKey,
    })) as Array<{ dayKey: string; drunkMl: number }>
    // Fusionne pending local non sync − suppressions locales non sync.
    return rows.map((row) => ({
      dayKey: row.dayKey,
      drunkMl: Math.max(
        0,
        row.drunkMl
          + pendingDrunkMlForDay(row.dayKey, userId)
          - localDeletedMlForDay(row.dayKey),
      ),
    }))
  } catch {
    return fallbackHydrationHistory(endDayKey, userId)
  }
}

function formatLocalDayEntries(
  dayKey: string,
  userId?: string | null,
): HydrationDayEntry[] {
  const pending = listPendingHydrationEntries(userId)
    .filter((e) => e.dayKey === dayKey && !isLocallyDeletedClientId(e.clientId, dayKey))
    .map((e) => ({
      clientId: e.clientId,
      amountMl: e.amountMl,
      createdAt: e.createdAt,
      source: e.source,
      pending: true as const,
    }))
  return pending.sort((a, b) => b.createdAt - a.createdAt)
}

export async function fetchHydrationDayEntries(
  dayKey = localDayKey(),
): Promise<HydrationDayEntry[]> {
  const userId = resolveActiveUserId()
  const localPending = formatLocalDayEntries(dayKey, userId)
  try {
    const sessionToken = await requireToken()
    const remote = (await getConvex().query(api.hydration.listDayEntries, {
      sessionToken,
      dayKey,
    })) as HydrationDayEntry[]
    const remoteFiltered = remote.filter(
      (e) => !isLocallyDeletedClientId(e.clientId, dayKey),
    )
    const remoteIds = new Set(remoteFiltered.map((e) => e.clientId))
    const onlyPending = localPending.filter((e) => !remoteIds.has(e.clientId))
    return [...onlyPending, ...remoteFiltered].sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return localPending
  }
}

/**
 * Suppression d’un ajout du jour — locale immédiate + Convex deleteEntry si dispo.
 * Deploy Convex requis pour la mutation ; sinon le total local reste correct.
 */
export async function deleteHydrationDayEntry(input: {
  clientId: string
  dayKey?: string
  amountMl: number
}): Promise<HydrationToday> {
  const dayKey = input.dayKey ?? localDayKey()
  const userId = resolveActiveUserId()
  removePendingHydrationEntry(input.clientId, userId)
  const deleted = readLocalDeleted().filter(
    (d) => !(d.clientId === input.clientId && d.dayKey === dayKey),
  )
  deleted.push({
    clientId: input.clientId,
    dayKey,
    amountMl: Math.round(input.amountMl),
    deletedAt: Date.now(),
    synced: false,
  })
  writeLocalDeleted(deleted)
  // Ajuste le cache confirmé localement pour carte / bouteille immédiates.
  const cache = readLocalSettings()
  if (cache?.confirmedByDay?.[dayKey] != null) {
    cache.confirmedByDay[dayKey] = Math.max(
      0,
      (cache.confirmedByDay[dayKey] ?? 0) - Math.round(input.amountMl),
    )
    writeLocalSettings(cache)
  }
  emitHydrationChanged()

  try {
    const sessionToken = await requireToken()
    const today = (await getConvex().mutation(api.hydration.deleteEntry, {
      sessionToken,
      dayKey,
      clientId: input.clientId,
    })) as Omit<HydrationToday, 'pendingMl' | 'confirmedMl'>
    writeLocalDeleted(
      readLocalDeleted().map((d) =>
        d.clientId === input.clientId && d.dayKey === dayKey
          ? { ...d, synced: true }
          : d,
      ),
    )
    writeLocalSettings(cacheFromToday(today, userId, dayKey))
    emitHydrationChanged()
    return mergePending(today, dayKey, userId)
  } catch {
    return fallbackToday(dayKey, userId)
  }
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
  const userId = resolveActiveUserId()
  // Optimiste : local immédiat (carte Eau / feuille / bouteille), même si Convex refuse.
  const local = applyHydrationSettingsLocal(input, userId)
  try {
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
    const prev = readLocalSettings()
    // Sync serveur OK — on garde toutefois les champs pending non couverts par ce patch.
    const stillPending = readPendingHydrationSettings()
    const remaining: PendingHydrationSettings = { ...(stillPending ?? {}) }
    for (const key of Object.keys(input) as (keyof PendingHydrationSettings)[]) {
      if (input[key] !== undefined) delete remaining[key]
    }
    writePendingHydrationSettings(
      Object.keys(remaining).length > 0 ? remaining : null,
    )
    const pendingLeft = readPendingHydrationSettings()
    writeLocalSettings({
      userId,
      mode: pendingLeft?.mode ?? settings.mode,
      goalMl: pendingLeft?.goalMl ?? settings.goalMl,
      myBottleVolumeMl:
        pendingLeft?.myBottleVolumeMl !== undefined
          ? pendingLeft.myBottleVolumeMl
          : (settings.myBottleVolumeMl ?? null),
      myBottleHasShape: settings.myBottleHasShape,
      remindersEnabled: pendingLeft?.remindersEnabled ?? settings.remindersEnabled,
      reminderTimes: pendingLeft?.reminderTimes ?? settings.reminderTimes,
      proActive: Boolean(result.proActive),
      confirmedByDay: prev?.userId === userId ? (prev.confirmedByDay ?? {}) : {},
    })
    emitHydrationChanged()
    // Réessaie d’éventuels autres champs pending (silencieux).
    if (pendingLeft) void flushPendingHydrationSettings()
    return result
  } catch {
    // Garde le local ; réessaie plus tard sans erreur visible.
    void flushPendingHydrationSettings()
    return {
      settings: {
        mode: local.mode,
        goalMl: local.goalMl,
        myBottleVolumeMl: local.myBottleVolumeMl ?? undefined,
        myBottleHasShape: local.myBottleHasShape,
        remindersEnabled: local.remindersEnabled,
        reminderTimes: local.reminderTimes,
      },
      proActive: local.proActive,
      pendingLocal: true as const,
    }
  }
}

let pendingFlushTimer: number | null = null

/** Réessaie le patch pending sans surface d’erreur UI. */
export async function flushPendingHydrationSettings(): Promise<boolean> {
  const pending = readPendingHydrationSettings()
  if (!pending || Object.keys(pending).length === 0) return true
  try {
    const sessionToken = await requireToken()
    await getConvex().mutation(api.hydration.updateSettings, {
      sessionToken,
      ...pending,
    })
    writePendingHydrationSettings(null)
    emitHydrationChanged()
    return true
  } catch {
    if (typeof window !== 'undefined') {
      if (pendingFlushTimer != null) window.clearTimeout(pendingFlushTimer)
      pendingFlushTimer = window.setTimeout(() => {
        pendingFlushTimer = null
        void flushPendingHydrationSettings()
      }, 15_000) as unknown as number
    }
    return false
  }
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
