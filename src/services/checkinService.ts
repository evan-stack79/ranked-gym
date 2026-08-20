import { getSupabase } from '../lib/supabase'
import type { CheckinRow } from '../types/database'

export async function createCheckin(input: {
  userId: string
  salleNom: string
  salleLat?: number
  salleLng?: number
}): Promise<CheckinRow> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      user_id: input.userId,
      salle_nom: input.salleNom,
      salle_lat: input.salleLat ?? null,
      salle_lng: input.salleLng ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
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
