import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

const api = generatedApi as any

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export async function fetchRewardsWallet() {
  const sessionToken = await requireToken()
  return getConvex().query(api.rewards.getWallet, { sessionToken })
}

export async function fetchRewardsCatalog() {
  const sessionToken = await requireToken()
  return getConvex().query(api.rewards.listCatalog, { sessionToken })
}

export async function redeemRewardsItem(itemId: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.rewards.redeemItem, { sessionToken, itemId })
}

export async function markRewardsCodeShown(redemptionId: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.rewards.markCodeShown, {
    sessionToken,
    redemptionId,
  })
}

export async function listMyRewardsCodes() {
  const sessionToken = await requireToken()
  return getConvex().query(api.rewards.listMyCodes, { sessionToken })
}

export const REWARDS_CATEGORY_LABELS: Record<string, string> = {
  'RP-CAT-01': 'Boisson / café',
  'RP-CAT-02': 'Snack / barre',
  'RP-CAT-03': 'Complément',
  'RP-CAT-04': 'Salle / cours',
  'RP-CAT-05': 'Équipement léger',
}
