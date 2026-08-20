import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { CalorieProfile, DayJournal } from '../types/nutrition'
import type { TrainingState } from '../types/training'
import {
  getCalorieProfile,
  getMealJournal,
  saveCalorieProfile,
  saveMealJournal,
} from './nutritionStorage'
import { getTrainingState, saveTrainingState } from './trainingStorage'

export const BACKUP_VERSION = 1 as const

export type CloudBackupPayload = {
  version: typeof BACKUP_VERSION
  updatedAt: string
  nutrition: {
    profile: CalorieProfile | null
    journal: Record<string, DayJournal>
  }
  training: TrainingState
}

const LOCAL_META_KEY = 'ranked-gym:cloud-backup-meta'

export type CloudBackupMeta = {
  lastPushAt: string | null
  lastPullAt: string | null
  lastError: string | null
  pending: boolean
}

type Listener = (meta: CloudBackupMeta) => void

let activeUserId: string | null = null
let meta: CloudBackupMeta = loadMeta()
const listeners = new Set<Listener>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pushing = false
let hydratedUserId: string | null = null
/** Block auto-push until first pull finishes (avoids overwriting cloud with stale local). */
let cloudSyncReady = false
let deferredPush = false

function loadMeta(): CloudBackupMeta {
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY)
    if (!raw) {
      return { lastPushAt: null, lastPullAt: null, lastError: null, pending: false }
    }
    const parsed = JSON.parse(raw) as Partial<CloudBackupMeta>
    return {
      lastPushAt: parsed.lastPushAt ?? null,
      lastPullAt: parsed.lastPullAt ?? null,
      lastError: parsed.lastError ?? null,
      pending: false,
    }
  } catch {
    return { lastPushAt: null, lastPullAt: null, lastError: null, pending: false }
  }
}

function persistMeta() {
  localStorage.setItem(
    LOCAL_META_KEY,
    JSON.stringify({
      lastPushAt: meta.lastPushAt,
      lastPullAt: meta.lastPullAt,
      lastError: meta.lastError,
    }),
  )
  listeners.forEach((l) => l({ ...meta }))
}

function setMeta(patch: Partial<CloudBackupMeta>) {
  meta = { ...meta, ...patch }
  persistMeta()
}

export function getCloudBackupMeta(): CloudBackupMeta {
  return { ...meta }
}

export function subscribeCloudBackup(listener: Listener): () => void {
  listeners.add(listener)
  listener({ ...meta })
  return () => {
    listeners.delete(listener)
  }
}

export function setCloudBackupUserId(userId: string | null) {
  activeUserId = userId
  if (!userId) {
    hydratedUserId = null
    cloudSyncReady = false
    deferredPush = false
    return
  }
  // New session: wait for hydrate before auto-push
  if (hydratedUserId !== userId) {
    cloudSyncReady = false
  }
}

export function notifyLocalDataChanged() {
  if (!activeUserId || !isSupabaseConfigured()) return
  if (!cloudSyncReady) {
    deferredPush = true
    setMeta({ pending: true })
    return
  }
  scheduleCloudPush(activeUserId)
}

export function collectLocalBackup(): CloudBackupPayload {
  return {
    version: BACKUP_VERSION,
    updatedAt: new Date().toISOString(),
    nutrition: {
      profile: getCalorieProfile(),
      journal: getMealJournal(),
    },
    training: getTrainingState(),
  }
}

function applyBackup(payload: CloudBackupPayload) {
  if (payload.nutrition?.profile) {
    saveCalorieProfile(payload.nutrition.profile, { skipCloud: true })
  }
  if (payload.nutrition?.journal) {
    saveMealJournal(payload.nutrition.journal, { skipCloud: true })
  }
  if (payload.training) {
    saveTrainingState(payload.training, { skipCloud: true })
  }
}

function isMissingTableError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  return (
    m.includes('user_backups') ||
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find the table')
  )
}

export async function pushCloudBackup(
  userId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const uid = userId ?? activeUserId
  if (!uid || !isSupabaseConfigured()) {
    return { ok: false, error: 'Connexion requise pour sauvegarder.' }
  }
  if (pushing) return { ok: false, error: 'already_pushing' }

  pushing = true
  setMeta({ pending: true, lastError: null })

  try {
    const payload = collectLocalBackup()
    const supabase = getSupabase()
    const { error } = await supabase.from('user_backups').upsert(
      {
        user_id: uid,
        payload: payload as unknown as import('../types/database').Json,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      const msg = isMissingTableError(error.message)
        ? 'Table manquante : exécute supabase/user_backups.sql dans le SQL Editor Supabase.'
        : error.message
      setMeta({ pending: false, lastError: msg })
      return { ok: false, error: msg }
    }

    setMeta({
      pending: false,
      lastPushAt: new Date().toISOString(),
      lastError: null,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de sauvegarde'
    setMeta({ pending: false, lastError: msg })
    return { ok: false, error: msg }
  } finally {
    pushing = false
  }
}

export async function pullCloudBackup(
  userId?: string | null,
): Promise<{ ok: boolean; applied: boolean; error?: string }> {
  const uid = userId ?? activeUserId
  if (!uid || !isSupabaseConfigured()) {
    return { ok: false, applied: false, error: 'Connexion requise.' }
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('user_backups')
      .select('payload, updated_at')
      .eq('user_id', uid)
      .maybeSingle()

    if (error) {
      const msg = isMissingTableError(error.message)
        ? 'Table manquante : exécute supabase/user_backups.sql dans le SQL Editor Supabase.'
        : error.message
      setMeta({ lastError: msg })
      return { ok: false, applied: false, error: msg }
    }

    if (!data?.payload) {
      setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
      await pushCloudBackup(uid)
      return { ok: true, applied: false }
    }

    const remote = data.payload as unknown as CloudBackupPayload
    const local = collectLocalBackup()
    const remoteTs = Date.parse(remote.updatedAt || data.updated_at || '') || 0
    const localTs = Date.parse(local.updatedAt) || 0

    // Prefer cloud when equal or newer (tolerance 2s for clock skew)
    if (remoteTs >= localTs - 2000) {
      applyBackup(remote)
      setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
      window.dispatchEvent(new Event('ranked-gym:backup-restored'))
      return { ok: true, applied: true }
    }

    setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
    await pushCloudBackup(uid)
    return { ok: true, applied: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de restauration'
    setMeta({ lastError: msg })
    return { ok: false, applied: false, error: msg }
  }
}

/** Debounced cloud push after any local save. */
export function scheduleCloudPush(userId: string | null | undefined) {
  if (!userId || !isSupabaseConfigured()) return
  setMeta({ pending: true })
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void pushCloudBackup(userId)
  }, 1200)
}

export async function hydrateCloudBackupForUser(userId: string) {
  if (!userId || !isSupabaseConfigured()) return
  setCloudBackupUserId(userId)
  if (hydratedUserId === userId) {
    cloudSyncReady = true
    return
  }
  hydratedUserId = userId
  await pullCloudBackup(userId)
  cloudSyncReady = true
  if (deferredPush) {
    deferredPush = false
    scheduleCloudPush(userId)
  }
}

export function resetCloudBackupHydration() {
  hydratedUserId = null
  cloudSyncReady = false
  deferredPush = false
  setCloudBackupUserId(null)
}
