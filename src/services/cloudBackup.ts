import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { safeError, safeWarn } from '../utils/safeLog'
import type { Json } from '../types/database'
import type { CalorieProfile, DayJournal } from '../types/nutrition'
import type { TrainingState } from '../types/training'
import type { NearbyGym } from '../types'
import {
  getCalorieProfile,
  getMealJournal,
  saveCalorieProfile,
  saveMealJournal,
} from './nutritionStorage'
import { getTrainingState, saveTrainingState } from './trainingStorage'
import {
  getProfileProgress,
  saveProfileProgress,
  type StoredProfileProgress,
} from './profileStorage'
import {
  getActiveCheckIn,
  getCustomGyms,
  saveCheckIn,
  saveCustomGyms,
  clearCheckIn,
  type StoredCheckIn,
} from './lobbyStorage'
import { getActiveCloudUserId as readCloudUserId, setActiveCloudUserId } from './cloudSession'

export const BACKUP_VERSION = 3 as const

export type CloudBackupPayload = {
  version: typeof BACKUP_VERSION
  updatedAt: string
  nutrition: {
    profile: CalorieProfile | null
    journal: Record<string, DayJournal>
  }
  training: TrainingState
  profileProgress?: StoredProfileProgress | null
  lobby?: {
    customGyms: NearbyGym[]
    checkIn: StoredCheckIn | null
  }
}

const LOCAL_META_KEY = 'ranked-gym:cloud-backup-meta'
const AUTO_DEBOUNCE_MS = 450

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
let needsRepush = false
let hydratedUserId: string | null = null
/** Block auto-push until first pull finishes (avoids overwriting cloud with empty local). */
let cloudSyncReady = false
let deferredPush = false
let lifecycleWired = false

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
  try {
    localStorage.setItem(
      LOCAL_META_KEY,
      JSON.stringify({
        lastPushAt: meta.lastPushAt,
        lastPullAt: meta.lastPullAt,
        lastError: meta.lastError,
      }),
    )
  } catch {
    // ignore quota
  }
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

export function getActiveCloudUserId(): string | null {
  return readCloudUserId()
}

export function setCloudBackupUserId(userId: string | null) {
  setActiveCloudUserId(userId)
  activeUserId = userId
  if (!userId) {
    hydratedUserId = null
    cloudSyncReady = false
    deferredPush = false
    needsRepush = false
    return
  }
  if (hydratedUserId !== userId) {
    cloudSyncReady = false
  }
}

/** Called after every local write — auto cloud save, no user action. */
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
    profileProgress: getProfileProgress(),
    lobby: {
      customGyms: getCustomGyms(),
      checkIn: getActiveCheckIn(),
    },
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
  if (payload.profileProgress) {
    saveProfileProgress(payload.profileProgress, { skipCloud: true })
  }
  if (payload.lobby) {
    saveCustomGyms(payload.lobby.customGyms ?? [], { skipCloud: true })
    if (payload.lobby.checkIn?.gym) {
      saveCheckIn(payload.lobby.checkIn.gym, {
        skipCloud: true,
        checkedInAt: payload.lobby.checkIn.checkedInAt,
      })
    } else {
      clearCheckIn({ skipCloud: true })
    }
  }
}

/** True only for missing-relation errors — never RLS / permission / network. */
function isMissingTableError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  if (!m) return false
  // Do NOT match bare table names — RLS messages often contain "workouts".
  return (
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist')) ||
    (m.includes('table') && m.includes('does not exist'))
  )
}

function isRlsOrAuthError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  return (
    m.includes('row-level security') ||
    m.includes('row level security') ||
    m.includes('violates row-level') ||
    m.includes('permission denied') ||
    m.includes('jwt') ||
    m.includes('not authenticated')
  )
}

function emitBackupEvent(
  name: 'ranked-gym:backup-saved' | 'ranked-gym:backup-error',
  detail?: { error?: string; source?: string },
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function payloadFromTables(input: {
  nutrition?: { profile: Json; journal: Json; updated_at: string } | null
  workouts?: { state: Json; progress: Json; updated_at: string } | null
  profile?: {
    custom_spots: Json
    active_checkin: Json | null
    updated_at: string
  } | null
}): CloudBackupPayload | null {
  const nutritionProfileObj = asObject(input.nutrition?.profile)
  const workoutStateObj = asObject(input.workouts?.state)
  const hasNutrition = Boolean(nutritionProfileObj && Object.keys(nutritionProfileObj).length > 0)
  const hasWorkouts = Boolean(workoutStateObj && Object.keys(workoutStateObj).length > 0)
  const hasLobby = Boolean(
    input.profile &&
      ((Array.isArray(input.profile.custom_spots) && input.profile.custom_spots.length > 0) ||
        input.profile.active_checkin),
  )

  if (!hasNutrition && !hasWorkouts && !hasLobby && !input.nutrition && !input.workouts) {
    return null
  }

  const nutritionProfile = (hasNutrition ? nutritionProfileObj : null) as CalorieProfile | null
  const nutritionJournal = (asObject(input.nutrition?.journal) ?? {}) as Record<string, DayJournal>
  const training = (hasWorkouts ? workoutStateObj : null) as TrainingState | null
  const progressObj = asObject(input.workouts?.progress)
  const progress = (progressObj && Object.keys(progressObj).length > 0
    ? progressObj
    : null) as StoredProfileProgress | null
  const customGyms = (Array.isArray(input.profile?.custom_spots)
    ? (input.profile?.custom_spots as unknown as NearbyGym[])
    : []) as NearbyGym[]
  const activeCheckin = (input.profile?.active_checkin ?? null) as unknown as StoredCheckIn | null

  const stamps = [
    input.nutrition?.updated_at,
    input.workouts?.updated_at,
    input.profile?.updated_at,
  ].filter(Boolean) as string[]
  const updatedAt =
    stamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? new Date().toISOString()

  return {
    version: BACKUP_VERSION,
    updatedAt,
    nutrition: {
      profile: nutritionProfile,
      journal: nutritionJournal ?? {},
    },
    training: training ?? getTrainingState(),
    profileProgress: progress,
    lobby: {
      customGyms,
      checkIn: activeCheckin,
    },
  }
}

function hasMeaningfulCloudData(payload: CloudBackupPayload): boolean {
  const meals = Object.values(payload.nutrition.journal ?? {}).some((d) => d.meals?.length > 0)
  const notes = (payload.training?.workoutNotes?.length ?? 0) > 0
  const completed = (payload.training?.completed?.length ?? 0) > 0
  const schedule = (payload.training?.schedule?.length ?? 0) > 0
  const routines = (payload.training?.routines ?? []).some((r) => (r.exercises?.length ?? 0) > 0)
  const onboarded = Boolean(payload.nutrition.profile?.onboardingComplete)
  const spots = (payload.lobby?.customGyms?.length ?? 0) > 0
  const checkIn = Boolean(payload.lobby?.checkIn?.gym)
  return meals || notes || completed || schedule || routines || onboarded || spots || checkIn
}

async function fetchRemotePayload(userId: string): Promise<{
  payload: CloudBackupPayload | null
  error?: string
}> {
  const supabase = getSupabase()

  const [nutritionRes, workoutsRes, profileRes] = await Promise.all([
    supabase.from('nutrition').select('profile, journal, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('workouts').select('state, progress, updated_at').eq('user_id', userId).maybeSingle(),
    supabase
      .from('profiles')
      .select('custom_spots, active_checkin, updated_at')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const tableError =
    nutritionRes.error?.message || workoutsRes.error?.message || profileRes.error?.message

  if (tableError && isMissingTableError(tableError)) {
    // Fallback legacy blob
    const { data, error } = await supabase
      .from('user_backups')
      .select('payload, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      return {
        payload: null,
        error: isMissingTableError(error.message)
          ? 'Tables manquantes : exécute supabase/schema.sql dans le SQL Editor Supabase.'
          : error.message,
      }
    }
    if (!data?.payload) return { payload: null }
    const legacy = data.payload as unknown as CloudBackupPayload
    return { payload: legacy }
  }

  if (tableError && !isMissingTableError(tableError)) {
    // nutrition/workouts may 404 if not created; profiles always exists
    if (nutritionRes.error && !isMissingTableError(nutritionRes.error.message)) {
      return { payload: null, error: nutritionRes.error.message }
    }
    if (workoutsRes.error && !isMissingTableError(workoutsRes.error.message)) {
      return { payload: null, error: workoutsRes.error.message }
    }
  }

  const fromTables = payloadFromTables({
    nutrition: nutritionRes.data,
    workouts: workoutsRes.data,
    profile: profileRes.data,
  })

  if (fromTables && hasMeaningfulCloudData(fromTables)) {
    return { payload: fromTables }
  }

  // Migrate legacy user_backups → new tables if tables are empty
  const { data: legacy } = await supabase
    .from('user_backups')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (legacy?.payload) {
    const payload = legacy.payload as unknown as CloudBackupPayload
    if (hasMeaningfulCloudData(payload) || payload.nutrition?.profile) {
      return { payload }
    }
  }

  return { payload: fromTables }
}

async function upsertTables(userId: string, payload: CloudBackupPayload): Promise<{ error?: string }> {
  const supabase = getSupabase()
  const now = payload.updatedAt || new Date().toISOString()
  const json = (v: unknown) => v as Json

  try {
    const [nutritionRes, workoutsRes, profileRes] = await Promise.all([
      supabase.from('nutrition').upsert(
        {
          user_id: userId,
          profile: json(payload.nutrition.profile ?? {}),
          journal: json(payload.nutrition.journal ?? {}),
          updated_at: now,
        },
        { onConflict: 'user_id' },
      ),
      supabase.from('workouts').upsert(
        {
          user_id: userId,
          state: json(payload.training ?? {}),
          progress: json(payload.profileProgress ?? {}),
          updated_at: now,
        },
        { onConflict: 'user_id' },
      ),
      supabase
        .from('profiles')
        .update({
          custom_spots: json(payload.lobby?.customGyms ?? []),
          active_checkin: json(payload.lobby?.checkIn ?? null),
          updated_at: now,
        })
        .eq('id', userId),
    ])

    const parts: { table: string; message: string }[] = []
    if (nutritionRes.error?.message) {
      parts.push({ table: 'nutrition', message: nutritionRes.error.message })
    }
    if (workoutsRes.error?.message) {
      parts.push({ table: 'workouts', message: workoutsRes.error.message })
    }
    if (profileRes.error?.message) {
      parts.push({ table: 'profiles', message: profileRes.error.message })
    }

    if (parts.length > 0) {
      for (const p of parts) {
        safeError(`[cloudBackup] upsert ${p.table} failed`, p.message)
      }

      const workoutsErr = workoutsRes.error?.message
      // Train data lives in workouts — surface that first
      const primary = workoutsErr || parts[0]?.message || 'Erreur Supabase'

      if (workoutsErr && isRlsOrAuthError(workoutsErr)) {
        return {
          error:
            'RLS bloque l’écriture workouts (INSERT/UPDATE). Exécute la migration workouts_rls_write_fix.sql.',
        }
      }

      const allMissing = parts.every((p) => isMissingTableError(p.message))
      if (allMissing) {
        const { error } = await supabase.from('user_backups').upsert(
          {
            user_id: userId,
            payload: json(payload),
            updated_at: now,
          },
          { onConflict: 'user_id' },
        )
        if (error) {
          safeError('[cloudBackup] fallback user_backups failed', error.message)
          return {
            error: isMissingTableError(error.message)
              ? 'Tables manquantes : exécute supabase/schema.sql dans le SQL Editor Supabase.'
              : error.message,
          }
        }
        safeWarn('[cloudBackup] tables manquantes — écriture via user_backups uniquement')
        return {}
      }

      return { error: primary }
    }

    const { error: mirrorError } = await supabase.from('user_backups').upsert(
      {
        user_id: userId,
        payload: json(payload),
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    if (mirrorError) {
      safeWarn('[cloudBackup] mirror user_backups failed (non-bloquant)', mirrorError.message)
    }

    return {}
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur upsert cloud'
    safeError('[cloudBackup] upsertTables exception', e)
    return { error: msg }
  }
}

export async function pushCloudBackup(
  userId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const uid = userId ?? activeUserId
  if (!uid || !isSupabaseConfigured()) {
    return { ok: false, error: 'Connecte-toi pour activer la sauvegarde cloud.' }
  }
  if (pushing) {
    needsRepush = true
    setMeta({ pending: true })
    return { ok: false, error: 'already_pushing' }
  }

  pushing = true
  setMeta({ pending: true, lastError: null })

  try {
    const payload = collectLocalBackup()
    const { error } = await upsertTables(uid, payload)
    if (error) {
      safeError('[cloudBackup] pushCloudBackup failed', error)
      setMeta({ pending: false, lastError: error })
      emitBackupEvent('ranked-gym:backup-error', { error, source: 'push' })
      return { ok: false, error }
    }
    setMeta({
      pending: false,
      lastPushAt: new Date().toISOString(),
      lastError: null,
    })
    emitBackupEvent('ranked-gym:backup-saved', { source: 'push' })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de sauvegarde'
    safeError('[cloudBackup] pushCloudBackup exception', e)
    setMeta({ pending: false, lastError: msg })
    emitBackupEvent('ranked-gym:backup-error', { error: msg, source: 'push' })
    return { ok: false, error: msg }
  } finally {
    pushing = false
    if (needsRepush && activeUserId) {
      needsRepush = false
      scheduleCloudPush(activeUserId)
    }
  }
}

/**
 * Pull cloud → local.
 * On login / new origin: cloud ALWAYS wins if remote has data.
 * Never overwrite cloud with empty localStorage from a new tunnel URL.
 */
export async function pullCloudBackup(
  userId?: string | null,
  options?: { preferRemote?: boolean },
): Promise<{ ok: boolean; applied: boolean; error?: string }> {
  const uid = userId ?? activeUserId
  if (!uid || !isSupabaseConfigured()) {
    return { ok: false, applied: false, error: 'Connexion requise.' }
  }

  const preferRemote = options?.preferRemote ?? true

  try {
    const { payload: remote, error } = await fetchRemotePayload(uid)
    if (error) {
      safeError('[cloudBackup] pullCloudBackup failed', error)
      setMeta({ lastError: error })
      emitBackupEvent('ranked-gym:backup-error', { error, source: 'pull' })
      return { ok: false, applied: false, error }
    }

    if (!remote || (!hasMeaningfulCloudData(remote) && !remote.nutrition.profile)) {
      // First account on this cloud: seed from current local (if any)
      setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
      await pushCloudBackup(uid)
      return { ok: true, applied: false }
    }

    if (preferRemote || hasMeaningfulCloudData(remote)) {
      applyBackup(remote)
      setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
      window.dispatchEvent(new Event('ranked-gym:backup-restored'))
      return { ok: true, applied: true }
    }

    setMeta({ lastPullAt: new Date().toISOString(), lastError: null })
    return { ok: true, applied: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de restauration'
    safeError('[cloudBackup] pullCloudBackup exception', e)
    setMeta({ lastError: msg })
    emitBackupEvent('ranked-gym:backup-error', { error: msg, source: 'pull' })
    return { ok: false, applied: false, error: msg }
  }
}

export function scheduleCloudPush(userId: string | null | undefined) {
  if (!userId || !isSupabaseConfigured()) return
  setMeta({ pending: true })
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushCloudBackup(userId)
  }, AUTO_DEBOUNCE_MS)
}

export function flushCloudPush() {
  void flushCloudPushAsync()
}

/** Flush immédiat — retourne le résultat (pour toasts Train / Sauver). */
export async function flushCloudPushAsync(): Promise<{ ok: boolean; error?: string }> {
  if (!activeUserId) {
    const error = 'Connecte-toi pour sauvegarder dans Supabase.'
    safeError('[cloudBackup] flush', error)
    return { ok: false, error }
  }
  if (!isSupabaseConfigured()) {
    const error = 'Supabase non configuré (VITE_SUPABASE_URL / ANON_KEY).'
    safeError('[cloudBackup] flush', error)
    return { ok: false, error }
  }
  if (!cloudSyncReady) {
    deferredPush = true
    setMeta({ pending: true })
    return { ok: false, error: 'Sync cloud pas encore prête — nouvel essai après hydratation.' }
  }
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  return pushCloudBackup(activeUserId)
}

function wireLifecycleOnce() {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true
  const flush = () => flushCloudPush()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
}

export async function hydrateCloudBackupForUser(userId: string) {
  if (!userId || !isSupabaseConfigured()) return
  setCloudBackupUserId(userId)
  wireLifecycleOnce()
  if (hydratedUserId === userId && cloudSyncReady) {
    return
  }
  hydratedUserId = userId
  // Cloud is source of truth after login (survives tunnel URL changes)
  await pullCloudBackup(userId, { preferRemote: true })
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
  needsRepush = false
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  setCloudBackupUserId(null)
}
