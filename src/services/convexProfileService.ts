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

type ConvexAvatarView = {
  url: string | null
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export function mapConvexProfileToRow(
  view: ConvexProfileView,
  avatarUrl: string | null = null,
): ProfileRow {
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
    avatar_url: avatarUrl,
    is_ghost_mode_enabled: view.isGhostModeEnabled,
    created_at: new Date(view.createdAt).toISOString(),
    updated_at: new Date(view.updatedAt).toISOString(),
  }
}

async function fetchOwnAvatarUrlForToken(sessionToken: string): Promise<string | null> {
  const file = (await getConvex().query(api.files.getOwnAvatar, {
    sessionToken,
  })) as ConvexAvatarView | null
  return file?.url ?? null
}

export async function fetchConvexProfile(_userId: string): Promise<ProfileRow | null> {
  const sessionToken = await requireToken()
  const [view, avatarUrl] = (await Promise.all([
    getConvex().query(api.profiles.getProfile, {
      sessionToken,
    }) as Promise<ConvexProfileView | null>,
    fetchOwnAvatarUrlForToken(sessionToken),
  ])) as [ConvexProfileView | null, string | null]
  return view ? mapConvexProfileToRow(view, avatarUrl) : null
}

export async function ensureConvexProfile(
  _userId: string,
  pseudo: string,
  disciplineLabel = 'Musculation',
): Promise<ProfileRow> {
  const sessionToken = await requireToken()
  const [view, avatarUrl] = (await Promise.all([
    getConvex().mutation(api.profiles.ensureProfile, {
      sessionToken,
      pseudo,
      discipline: disciplineLabel,
    }) as Promise<ConvexProfileView>,
    fetchOwnAvatarUrlForToken(sessionToken),
  ])) as [ConvexProfileView, string | null]
  return mapConvexProfileToRow(view, avatarUrl)
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
  const [view, avatarUrl] = (await Promise.all([
    getConvex().mutation(api.profiles.updateProfile, {
      sessionToken,
      level: patch.level,
      xp: patch.xp,
      rank: patch.rank,
      pseudo: patch.pseudo,
      discipline: patch.discipline,
      isGhostModeEnabled: patch.is_ghost_mode_enabled,
      currentStreak: patch.current_streak,
      lastLoginDate: patch.last_login_date,
    }) as Promise<ConvexProfileView>,
    fetchOwnAvatarUrlForToken(sessionToken),
  ])) as [ConvexProfileView, string | null]
  return mapConvexProfileToRow(view, avatarUrl)
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
  const [result, avatarUrl] = (await Promise.all([
    getConvex().mutation(api.profiles.applyDailyLoginStreak, {
      sessionToken,
      expectedLastLoginDate: input.expectedLastLoginDate,
      today: input.today,
      nextStreak: input.nextStreak,
      nextLevel: input.nextLevel,
      nextXp: input.nextXp,
      nextRank: input.nextRank,
    }) as Promise<{ didUpdate: boolean; profile: ConvexProfileView }>,
    fetchOwnAvatarUrlForToken(sessionToken),
  ])) as [{ didUpdate: boolean; profile: ConvexProfileView }, string | null]
  return {
    didUpdate: result.didUpdate,
    profile: mapConvexProfileToRow(result.profile, avatarUrl),
  }
}
