import { getSupabase } from '../lib/supabase'
import type { CheckinRow, Json } from '../types/database'
import type { NearbyGym } from '../types'
import { isConvexDomainActive } from '../backend/adapter'
import {
  countConvexCheckins,
  createConvexCheckin,
  listConvexRecentCheckins,
} from './convexCheckinService'
import { recordActivityEvent } from './activityFeedService'

export async function createCheckin(input: {
  userId: string
  salleNom: string
  salleLat?: number
  salleLng?: number
  gym?: NearbyGym
}): Promise<CheckinRow> {
  if (isConvexDomainActive()) {
    const created = await createConvexCheckin({
      salleNom: input.salleNom,
      salleLat: input.salleLat,
      salleLng: input.salleLng,
      gym: input.gym,
    })
    void recordActivityEvent({
      activityType: 'checkin',
      actionText: `a check-in a ${input.salleNom}`,
      xpEarned: 90,
      originLat: input.salleLat ?? null,
      originLng: input.salleLng ?? null,
    })
    return created
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      user_id: input.userId,
      salle_nom: input.salleNom,
      salle_lat: input.salleLat ?? null,
      salle_lng: input.salleLng ?? null,
      gym_payload: (input.gym ?? null) as Json | null,
    })
    .select('*')
    .single()

  if (error) throw error

  void recordActivityEvent({
    activityType: 'checkin',
    actionText: `a check-in à ${input.salleNom}`,
    xpEarned: 90,
    originLat: input.salleLat ?? null,
    originLng: input.salleLng ?? null,
  })

  return data
}

export async function listRecentCheckins(userId: string, limit = 20): Promise<CheckinRow[]> {
  if (isConvexDomainActive()) {
    void userId
    return listConvexRecentCheckins(limit)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

/** Nombre total de check-ins (Lobby) pour l’utilisateur. */
export async function countCheckins(userId: string): Promise<number> {
  if (isConvexDomainActive()) {
    void userId
    return countConvexCheckins()
  }
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return count ?? 0
}
