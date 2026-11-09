import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex, isConvexConfigured } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'

const api = generatedApi as any

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export function isSubscriptionsBackendReady(): boolean {
  return isConvexConfigured()
}

export async function fetchProStatus() {
  const sessionToken = await requireToken()
  return getConvex().query(api.subscriptions.getProStatus, { sessionToken })
}

export async function fetchSubscriptionProfile() {
  const sessionToken = await requireToken()
  return getConvex().query(api.subscriptions.getSubscriptionProfile, { sessionToken })
}

export async function setDateOfBirth(dateOfBirth: string) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.subscriptions.setDateOfBirth, {
    sessionToken,
    dateOfBirth,
  })
}

/** ARCHI recordPurchaseConsent — avant ouverture feuille store. */
export async function recordPurchaseConsent(args: {
  offerKey: 'solo_monthly' | 'solo_yearly'
  withdrawalConsent: boolean
  legalVersion: string
}) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.subscriptions.recordPurchaseConsent, {
    sessionToken,
    offerKey: args.offerKey,
    withdrawalConsent: args.withdrawalConsent,
    legalVersion: args.legalVersion,
  })
}

export async function verifyApplePurchase(args: {
  signedTransaction: string
  signedRenewalInfo?: string
  purchaseAttemptId?: string
}) {
  const sessionToken = await requireToken()
  return getConvex().action(api.subscriptionsActions.verifyApplePurchase, {
    sessionToken,
    signedTransaction: args.signedTransaction,
    signedRenewalInfo: args.signedRenewalInfo,
    purchaseAttemptId: args.purchaseAttemptId,
  })
}

export async function verifyGooglePurchase(args: {
  purchaseToken: string
  productId: string
  basePlanId?: string
  purchaseAttemptId?: string
}) {
  const sessionToken = await requireToken()
  return getConvex().action(api.subscriptionsActions.verifyGooglePurchase, {
    sessionToken,
    purchaseToken: args.purchaseToken,
    productId: args.productId,
    basePlanId: args.basePlanId,
    purchaseAttemptId: args.purchaseAttemptId,
  })
}

export async function fetchLatestReceipt() {
  const sessionToken = await requireToken()
  return getConvex().query(api.subscriptions.getLatestReceipt, { sessionToken })
}
