import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import type { ProfileRow } from '../types/database'

const api = generatedApi as any

export type ConvexProfileView = {
  userId: string
  pseudo: string
  level: number
  xp: number
  rank: string
  discipline: string
  isGhostModeEnabled: boolean
  avatarFileId?: string
  currentStreak: number
  lastLoginDate: string | null
  createdAt: number
  updatedAt: number
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export function mapConvexProfileToRow(view: ConvexProfileView): ProfileRow {
  return {
    id: view.userId,
    pseudo: view.pseudo,
    level: view.level,
    xp: view.xp,
    rank: view.rank,
    discipline: view.discipline,
    custom_spots: [],
    active_checkin: null,
    current_streak: view.currentStreak,
    last_login_date: view.lastLoginDate,
    avatar_url: null,
    is_ghost_mode_enabled: view.isGhostModeEnabled,
    created_at: new Date(view.createdAt).toISOString(),
    updated_at: new Date(view.updatedAt).toISOString(),
  }
}

export async function fetchConvexProfile(_userId: string): Promise<ProfileRow | null> {
  const sessionToken = await requireToken()
  const view = (await getConvex().query(api.profiles.getProfile, {
    sessionToken,
  })) as ConvexProfileView | null
  return view ? mapConvexProfileToRow(view) : null
}

export async function ensureConvexProfile(
  _userId: string,
  pseudo: string,
  disciplineLabel = 'Musculation',
): Promise<ProfileRow> {
  const sessionToken = await requireToken()
  const view = (await getConvex().mutation(api.profiles.ensureProfile, {
    sessionToken,
    pseudo,
    discipline: disciplineLabel,
  })) as ConvexProfileView
  return mapConvexProfileToRow(view)
}

export async function updateConvexProfileProgress(
  _userId: string,
  patch: {
    level?: number
    xp?: number
    rank?: string
    pseudo?: string
    discipline?: string
    current_streak?: number
    last_login_date?: string | null
    avatar_url?: string | null
    is_ghost_mode_enabled?: boolean
  },
): Promise<ProfileRow> {
  void patch.avatar_url
  const sessionToken = await requireToken()
  const view = (await getConvex().mutation(api.profiles.updateProfile, {
    sessionToken,
    level: patch.level,
    xp: patch.xp,
    rank: patch.rank,
    pseudo: patch.pseudo,
    discipline: patch.discipline,
    isGhostModeEnabled: patch.is_ghost_mode_enabled,
    currentStreak: patch.current_streak,
    lastLoginDate: patch.last_login_date,
  })) as ConvexProfileView
  return mapConvexProfileToRow(view)
}

export async function applyConvexDailyLoginStreak(input: {
  expectedLastLoginDate: string | null
  today: string
  nextStreak: number
  nextLevel: number
  nextXp: number
  nextRank: string
}): Promise<{ didUpdate: boolean; profile: ProfileRow }> {
  const sessionToken = await requireToken()
  const result = (await getConvex().mutation(api.profiles.applyDailyLoginStreak, {
    sessionToken,
    expectedLastLoginDate: input.expectedLastLoginDate,
    today: input.today,
    nextStreak: input.nextStreak,
    nextLevel: input.nextLevel,
    nextXp: input.nextXp,
    nextRank: input.nextRank,
  })) as { didUpdate: boolean; profile: ConvexProfileView }
  return {
    didUpdate: result.didUpdate,
    profile: mapConvexProfileToRow(result.profile),
  }
}
