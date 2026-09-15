import { api as generatedApi } from '../../convex/_generated/api'
import type { LocalActivityItem } from '../data/localActivityFeed'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import { safeWarn } from '../utils/safeLog'

const api = generatedApi as any

type ConvexSocialActivityRow = {
  id: string
  user_id: string
  pseudo: string
  activity_type: string
  action_text: string
  xp_earned: number
  distance_label: string | null
  created_at: string
  is_self: boolean
  is_ghost_mode_enabled: boolean
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

function mapRow(row: ConvexSocialActivityRow): LocalActivityItem {
  const isPr = row.activity_type === 'pr' || row.activity_type === 'rank_up'
  return {
    id: row.id,
    user: row.pseudo,
    action: row.action_text,
    hasLocation: Boolean(row.distance_label),
    locationStyle: row.distance_label === 'Pres de toi' ? 'near' : 'zone',
    distanceLabel: row.distance_label,
    isGhostModeEnabled: Boolean(row.is_ghost_mode_enabled),
    xp: `+${row.xp_earned} XP`,
    time: formatRelativeTime(row.created_at),
    isPr,
    hot: isPr || row.xp_earned >= 200,
    isSelf: row.is_self,
  }
}

async function readToken(): Promise<string | null> {
  try {
    return await getConvexSessionToken()
  } catch {
    return null
  }
}

export async function fetchConvexSocialActivityFeed(input: {
  viewerLat?: number | null
  viewerLng?: number | null
  radiusKm?: number
  limit?: number
}): Promise<LocalActivityItem[]> {
  try {
    const sessionToken = await readToken()
    const rows = (await getConvex().query(api.rpc.getSocialFeed, {
      sessionToken: sessionToken ?? undefined,
      viewerLat: input.viewerLat ?? null,
      viewerLng: input.viewerLng ?? null,
      radiusKm: input.radiusKm ?? 25,
      limit: input.limit ?? 20,
    })) as ConvexSocialActivityRow[]
    return rows.map(mapRow)
  } catch (error) {
    safeWarn('[activityFeed] convex', error)
    return []
  }
}

export async function recordConvexActivityEvent(input: {
  activityType: 'pr' | 'workout' | 'checkin' | 'rank_up' | 'streak'
  actionText: string
  xpEarned?: number
  originLat?: number | null
  originLng?: number | null
}): Promise<string | null> {
  try {
    const sessionToken = await getConvexSessionToken()
    if (!sessionToken) return null
    const id = (await getConvex().mutation(api.rpc.recordActivity, {
      sessionToken,
      activityType: input.activityType,
      actionText: input.actionText,
      xpEarned: input.xpEarned ?? 0,
      originLat: input.originLat ?? null,
      originLng: input.originLng ?? null,
    })) as string
    return id
  } catch (error) {
    safeWarn('[activityFeed] convex record', error)
    return null
  }
}
