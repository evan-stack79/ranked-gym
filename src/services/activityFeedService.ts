import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { LocalActivityItem } from '../data/localActivityFeed'
import { buildLocalActivityFeed } from '../data/localActivityFeed'
import { safeWarn } from '../utils/safeLog'

export type SocialActivityRow = {
  id: string
  user_id: string
  pseudo: string
  activity_type: string
  action_text: string
  xp_earned: number
  distance_label: string | null
  created_at: string
  is_self: boolean
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

function mapRow(row: SocialActivityRow, viewer?: { isGhostModeEnabled: boolean } | null): LocalActivityItem {
  const isPr = row.activity_type === 'pr' || row.activity_type === 'rank_up'
  return {
    id: row.id,
    user: row.pseudo,
    action: row.action_text,
    hasLocation: Boolean(row.distance_label),
    locationStyle: row.distance_label === 'Près de toi' ? 'near' : 'zone',
    distanceLabel: row.distance_label,
    isGhostModeEnabled: row.is_self ? Boolean(viewer?.isGhostModeEnabled) : false,
    xp: `+${row.xp_earned} XP`,
    time: formatRelativeTime(row.created_at),
    isPr,
    hot: isPr || row.xp_earned >= 200,
    isSelf: row.is_self,
  }
}

export async function fetchSocialActivityFeed(input: {
  viewerLat?: number | null
  viewerLng?: number | null
  radiusKm?: number
  limit?: number
  areaName: string
  viewer?: { username: string; isGhostModeEnabled: boolean } | null
}): Promise<LocalActivityItem[]> {
  if (!isSupabaseConfigured()) {
    return buildLocalActivityFeed(input.areaName, input.viewer ?? null)
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('get_social_activity_feed', {
      p_viewer_lat: input.viewerLat ?? null,
      p_viewer_lng: input.viewerLng ?? null,
      p_radius_km: input.radiusKm ?? 25,
      p_limit: input.limit ?? 20,
    })

    if (error) throw error
    const rows = (data ?? []) as SocialActivityRow[]
    if (rows.length === 0) {
      return buildLocalActivityFeed(input.areaName, input.viewer ?? null)
    }
    return rows.map((row) => mapRow(row, input.viewer ?? null))
  } catch (error) {
    safeWarn('[activityFeed]', error)
    return buildLocalActivityFeed(input.areaName, input.viewer ?? null)
  }
}

export async function recordActivityEvent(input: {
  activityType: 'pr' | 'workout' | 'checkin' | 'rank_up' | 'streak'
  actionText: string
  xpEarned?: number
  originLat?: number | null
  originLng?: number | null
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('record_activity', {
      p_activity_type: input.activityType,
      p_action_text: input.actionText,
      p_xp_earned: input.xpEarned ?? 0,
      p_origin_lat: input.originLat ?? null,
      p_origin_lng: input.originLng ?? null,
    })
    if (error) throw error
    return typeof data === 'string' ? data : null
  } catch (error) {
    safeWarn('[activityFeed] record', error)
    return null
  }
}
