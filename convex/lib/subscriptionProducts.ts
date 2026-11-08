import { PRO_OFFERS, type ProOfferKey } from '../../shared/subscriptions/constants'

export type AllowedOffer = {
  key: ProOfferKey
  billingPeriod: 'month' | 'year'
  productIdApple: string
  productIdGoogle: string
  basePlanIdGoogle?: string
}

const OFFER_BY_KEY: Record<ProOfferKey, AllowedOffer> = {
  solo_monthly: {
    key: 'solo_monthly',
    billingPeriod: 'month',
    productIdApple: PRO_OFFERS.monthly.productIdApple,
    productIdGoogle: PRO_OFFERS.monthly.productIdGoogle,
    basePlanIdGoogle: PRO_OFFERS.monthly.basePlanIdGoogle,
  },
  solo_yearly: {
    key: 'solo_yearly',
    billingPeriod: 'year',
    productIdApple: PRO_OFFERS.yearly.productIdApple,
    productIdGoogle: PRO_OFFERS.yearly.productIdGoogle,
    basePlanIdGoogle: PRO_OFFERS.yearly.basePlanIdGoogle,
  },
}

export function listAllowedOffers(): AllowedOffer[] {
  return [OFFER_BY_KEY.solo_monthly, OFFER_BY_KEY.solo_yearly]
}

export function offerByKey(key: string): AllowedOffer | null {
  if (key === 'solo_monthly' || key === 'solo_yearly') return OFFER_BY_KEY[key]
  return null
}

export function isAllowedAppleProductId(productId: string): boolean {
  return listAllowedOffers().some((o) => o.productIdApple === productId)
}

export function isAllowedGoogleProductId(productId: string): boolean {
  return listAllowedOffers().some((o) => o.productIdGoogle === productId)
}

export function billingPeriodForAppleProduct(productId: string): 'month' | 'year' | null {
  const hit = listAllowedOffers().find((o) => o.productIdApple === productId)
  return hit?.billingPeriod ?? null
}

export function billingPeriodForGoogle(
  productId: string,
  basePlanId?: string | null,
): 'month' | 'year' | null {
  const hit = listAllowedOffers().find(
    (o) =>
      o.productIdGoogle === productId &&
      (!basePlanId || !o.basePlanIdGoogle || o.basePlanIdGoogle === basePlanId),
  )
  return hit?.billingPeriod ?? null
}

/** Duo/Squad product ids must never be accepted in v0. */
export const FORBIDDEN_V0_PRODUCT_FRAGMENTS = ['duo', 'squad', 'family'] as const

export function assertSoloProductId(productId: string): void {
  const lower = productId.toLowerCase()
  for (const frag of FORBIDDEN_V0_PRODUCT_FRAGMENTS) {
    if (lower.includes(frag)) {
      throw new Error(`Produit non autorisé en v0: ${productId}`)
    }
  }
}
