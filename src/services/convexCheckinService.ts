import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import type { CheckinRow, Json } from '../types/database'

const api = generatedApi as any

type ConvexCheckinView = {
  id: string
  user_id: string
  salle_nom: string
  salle_lat: number | null
  salle_lng: number | null
  gym_payload: unknown
  created_at: string
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

function mapCheckin(view: ConvexCheckinView): CheckinRow {
  return {
    id: view.id,
    user_id: view.user_id,
    salle_nom: view.salle_nom,
    salle_lat: view.salle_lat,
    salle_lng: view.salle_lng,
    gym_payload: (view.gym_payload ?? null) as Json | null,
    created_at: view.created_at,
  }
}

export async function createConvexCheckin(input: {
  salleNom: string
}): Promise<CheckinRow> {
  const sessionToken = await requireToken()
  // Do not send salleLat/salleLng/gymPayload — server also strips if present.
  const view = (await getConvex().mutation(api.rpc.createCheckin, {
    sessionToken,
    salleNom: input.salleNom,
  })) as ConvexCheckinView
  return mapCheckin(view)
}

export async function listConvexRecentCheckins(limit = 20): Promise<CheckinRow[]> {
  const sessionToken = await requireToken()
  const views = (await getConvex().query(api.rpc.listRecentCheckins, {
    sessionToken,
    limit,
  })) as ConvexCheckinView[]
  return views.map(mapCheckin)
}

export async function countConvexCheckins(): Promise<number> {
  const sessionToken = await requireToken()
  const count = (await getConvex().query(api.rpc.countCheckins, {
    sessionToken,
  })) as number
  return Number.isFinite(count) ? count : 0
}
