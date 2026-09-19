import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import type { CalorieProfile, DayJournal } from '../types/nutrition'
import type { TrainingState } from '../types/training'
import type { StoredProfileProgress } from './profileStorage'
import type { NearbyGym } from '../types'
import type { StoredCheckIn } from './lobbyStorage'
import type { SleepNightEntry } from './sleepStorage'

const api = generatedApi as any

export type ConvexBackupPayload = {
  version: number
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
  sleep?: SleepNightEntry[]
}

type ConvexSyncSnapshot = {
  serverVersion: number
  updatedAt: number
  workouts: {
    stateJson: unknown
    progressJson: unknown
    updatedAt: number
  } | null
  nutrition: {
    profileJson: unknown
    journalJson: unknown
    updatedAt: number
  } | null
  sleep: Array<{
    dateKey: string
    bedtime: string
    waketime: string
    tstHours: number | null
    createdAt: number
    updatedAt: number
  }>
  lobby: {
    customGyms: unknown
    checkIn: unknown
  }
}

type ConvexPushResult = {
  applied: boolean
  skippedEmptyOverwrite: boolean
  stale: boolean
  serverVersion: number
  updatedAt: number
  clientMutationId?: string
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

export function snapshotToBackupPayload(
  snapshot: ConvexSyncSnapshot,
  fallbackTraining: TrainingState,
): ConvexBackupPayload | null {
  const nutritionProfile = asObject(snapshot.nutrition?.profileJson) as CalorieProfile | null
  const nutritionJournal = (asObject(snapshot.nutrition?.journalJson) ?? {}) as Record<string, DayJournal>
  const training = asObject(snapshot.workouts?.stateJson) as TrainingState | null
  const progress = asObject(snapshot.workouts?.progressJson) as StoredProfileProgress | null
  const customGyms = Array.isArray(snapshot.lobby.customGyms)
    ? (snapshot.lobby.customGyms as NearbyGym[])
    : []
  const checkIn = (snapshot.lobby.checkIn ?? null) as StoredCheckIn | null
  const sleep: SleepNightEntry[] = (snapshot.sleep ?? []).map((night) => ({
    id: `sleep-${night.dateKey}`,
    dateKey: night.dateKey,
    bedtime: night.bedtime,
    waketime: night.waketime,
    tstHours: night.tstHours,
    createdAt: new Date(night.createdAt).toISOString(),
  }))

  const hasAnything =
    Boolean(snapshot.nutrition) ||
    Boolean(snapshot.workouts) ||
    sleep.length > 0 ||
    customGyms.length > 0 ||
    Boolean(checkIn)

  if (!hasAnything) return null

  return {
    version: 4,
    updatedAt: new Date(snapshot.updatedAt || Date.now()).toISOString(),
    nutrition: {
      profile: nutritionProfile,
      journal: nutritionJournal,
    },
    training: training ?? fallbackTraining,
    profileProgress: progress,
    lobby: {
      customGyms,
      checkIn,
    },
    sleep,
  }
}

export function backupPayloadToPushArgs(payload: ConvexBackupPayload) {
  return {
    nutrition: {
      profileJson: payload.nutrition.profile ?? {},
      journalJson: payload.nutrition.journal ?? {},
    },
    workouts: {
      stateJson: payload.training ?? {},
      progressJson: payload.profileProgress ?? {},
    },
    sleep: (payload.sleep ?? []).map((night) => ({
      dateKey: night.dateKey,
      bedtime: night.bedtime,
      waketime: night.waketime,
      tstHours: night.tstHours,
      createdAt: Date.parse(night.createdAt) || undefined,
    })),
    lobby: {
      customGyms: payload.lobby?.customGyms ?? [],
      checkIn: payload.lobby?.checkIn ?? null,
    },
  }
}

export async function fetchConvexBackupPayload(
  fallbackTraining: TrainingState,
): Promise<{ payload: ConvexBackupPayload | null; error?: string; serverVersion: number }> {
  try {
    const sessionToken = await requireToken()
    const snapshot = (await getConvex().query(api.sync.bootstrapSync, {
      sessionToken,
    })) as ConvexSyncSnapshot
    return {
      payload: snapshotToBackupPayload(snapshot, fallbackTraining),
      serverVersion: snapshot.serverVersion,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur Convex sync'
    return { payload: null, error: message, serverVersion: 0 }
  }
}

export async function pushConvexBackupPayload(
  payload: ConvexBackupPayload,
  options?: { baseUpdatedAt?: number; clientMutationId?: string },
): Promise<{ error?: string; skippedEmptyOverwrite?: boolean; stale?: boolean }> {
  try {
    const sessionToken = await requireToken()
    const result = (await getConvex().mutation(api.sync.pushSync, {
      sessionToken,
      clientMutationId: options?.clientMutationId,
      baseUpdatedAt: options?.baseUpdatedAt,
      ...backupPayloadToPushArgs(payload),
    })) as ConvexPushResult
    if (result.skippedEmptyOverwrite) {
      return { skippedEmptyOverwrite: true }
    }
    if (result.stale) {
      return { stale: true, error: 'SYNC_STALE_BASE_VERSION' }
    }
    return {}
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur Convex upsert'
    return { error: message }
  }
}
