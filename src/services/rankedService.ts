import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

const api = generatedApi as any

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export type RankedForceExerciseId =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'barbell_row'
  | 'ohp'

export const RANKED_FORCE_LABELS: Record<RankedForceExerciseId, string> = {
  squat: 'Squat',
  bench: 'Développé couché',
  deadlift: 'Soulevé de terre',
  barbell_row: 'Row barre',
  ohp: 'OHP (développé militaire)',
}

export async function fetchPublicRankedMethod() {
  return getConvex().query(api.ranked.getPublicMethod, {})
}

export async function fetchMyRankedStatus() {
  const sessionToken = await requireToken()
  return getConvex().query(api.ranked.getMyStatus, { sessionToken })
}

export async function setRankedOptIn(input: {
  forceEnabled: boolean
  disciplineEnabled: boolean
}) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.setOptIn, {
    sessionToken,
    forceEnabled: input.forceEnabled,
    disciplineEnabled: input.disciplineEnabled,
  })
}

export async function submitRankedLift(input: {
  canonicalExerciseId: string
  weightKg: number
  reps: number
  sourceSessionId?: string
}) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.submitLift, {
    sessionToken,
    ...input,
  })
}

export async function listMyRankedLifts(limit = 40) {
  const sessionToken = await requireToken()
  return getConvex().query(api.ranked.listMyLifts, { sessionToken, limit })
}

export async function listMyVerifiedPrs() {
  const sessionToken = await requireToken()
  return getConvex().query(api.ranked.listMyVerifiedPrs, { sessionToken })
}

export async function requestRankedVerify(input: {
  liftLogId: string
  method: 'self_24h' | 'friend_18'
  friendId?: string
}) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.requestVerify, {
    sessionToken,
    liftLogId: input.liftLogId,
    method: input.method,
    friendId: input.friendId,
  })
}

export async function confirmRankedVerifySelf(liftLogId: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.confirmVerifySelf, {
    sessionToken,
    liftLogId,
  })
}

export async function notifyRankedSessionCompleted(sourceSessionId?: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.onSessionCompleted, {
    sessionToken,
    sourceSessionId,
  })
}

export async function setRankedInjuryPause(untilMs: number | null) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.setInjuryPause, {
    sessionToken,
    untilMs,
  })
}

export async function fetchFriendsLeaderboard(axis: 'force' | 'discipline') {
  const sessionToken = await requireToken()
  return getConvex().query(api.ranked.leaderboardFriends, { sessionToken, axis })
}

export async function fetchMyLeague() {
  const sessionToken = await requireToken()
  return getConvex().query(api.ranked.myLeague, { sessionToken })
}

export async function requestRankedFriendship(friendUserId: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.ranked.requestFriendship, {
    sessionToken,
    friendUserId,
  })
}
