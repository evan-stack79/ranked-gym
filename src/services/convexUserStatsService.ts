import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

const api = generatedApi as any

export async function fetchConvexUserStatsRaw(): Promise<unknown> {
  const sessionToken = await getConvexSessionToken()
  if (!sessionToken) throw new Error('AUTH_SESSION_MISSING')
  return getConvex().query(api.rpc.getUserStats, { sessionToken })
}
