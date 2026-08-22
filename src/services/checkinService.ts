import { getSupabase } from '../lib/supabase'
import type { CheckinRow, Json } from '../types/database'
import type { NearbyGym } from '../types'
import { recordActivityEvent } from './activityFeedService'

export async function createCheckin(input: {
  userId: string
  salleNom: string
  salleLat?: number
  salleLng?: number
  gym?: NearbyGym
}): Promise<CheckinRow> {
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
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return count ?? 0
}
