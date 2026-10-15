import { getSupabase } from '../lib/supabase'
import type { CheckinRow, Json } from '../types/database'
import { runWithDomainBackend } from '../backend/domainBackend'
import {
  countConvexCheckins,
  createConvexCheckin,
  listConvexRecentCheckins,
} from './convexCheckinService'
import { recordActivityEvent } from './activityFeedService'

export async function createCheckin(input: {
  userId: string
  salleNom: string
  /** @deprecated Ignored — location no longer stored. */
  salleLat?: number
  /** @deprecated Ignored — location no longer stored. */
  salleLng?: number
  /** @deprecated Ignored — gym payload may contain lat/lng. */
  gym?: unknown
}): Promise<CheckinRow> {
  void input.salleLat
  void input.salleLng
  void input.gym
  const created = await runWithDomainBackend<CheckinRow>({
    operation: 'checkins.create',
    convex: () =>
      createConvexCheckin({
        salleNom: input.salleNom,
      }),
    supabase: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('checkins')
        .insert({
          user_id: input.userId,
          salle_nom: input.salleNom,
          salle_lat: null,
          salle_lng: null,
          gym_payload: null as Json | null,
        })
        .select('*')
        .single()

      if (error) throw error
      return data
    },
  })

  void recordActivityEvent({
    activityType: 'checkin',
    actionText: `a check-in à ${input.salleNom}`,
    xpEarned: 90,
    originLat: null,
    originLng: null,
  })
  return created
}

export async function listRecentCheckins(userId: string, limit = 20): Promise<CheckinRow[]> {
  return runWithDomainBackend<CheckinRow[]>({
    operation: 'checkins.listRecent',
    convex: () => listConvexRecentCheckins(limit),
    supabase: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data ?? []
    },
  })
}

/** Nombre total de check-ins (historique, sans coords) pour l’utilisateur. */
export async function countCheckins(userId: string): Promise<number> {
  return runWithDomainBackend<number>({
    operation: 'checkins.count',
    convex: () => countConvexCheckins(),
    supabase: async () => {
      const supabase = getSupabase()
      const { count, error } = await supabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw error
      return count ?? 0
    },
  })
}
