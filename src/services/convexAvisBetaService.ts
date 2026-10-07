import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

const api = generatedApi as any

export type AvisType = 'bug' | 'idee' | 'autre'

export type SubmitAvisClientResult =
  | {
      ok: true
      avisId: string
      statut: string
      signalUrgent: boolean
      distressLevel: 0 | 1 | 2
      motsMasques: boolean
      duplicate: boolean
      needsReformulation: boolean
    }
  | {
      ok: false
      error: string
      reason?: string
      needsReformulation?: boolean
    }

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_REQUIRED')
  return token
}

export async function submitAvisBeta(input: {
  type: AvisType
  texte: string
  page: string
  version: string
  cleAntiDoublon: string
  consentementAccepte: boolean
  forcerEnvoiAvecInsultes?: boolean
}): Promise<SubmitAvisClientResult> {
  const sessionToken = await requireToken()
  const convex = getConvex()
  return (await convex.mutation(api.avisBeta.submitAvis, {
    sessionToken,
    ...input,
  })) as SubmitAvisClientResult
}

export function createAvisAntiDoublonKey(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  return `avis-${rand}`
}
