/**
 * Faux store de test (ARCHI §10.1) — jamais sélectionnable par un argument joueur en prod.
 * Les preuves sont des payloads `localtest.{json}` refusés si SUBSCRIPTION_DEPLOY_ENV=production.
 */
import { PRO_OFFERS } from '../../../shared/subscriptions/constants'
import type { PurchasesAdapter, PurchaseResult, StoreOffer } from './types'

export function createFakeStoreAdapter(opts?: {
  eligibleForTrial?: boolean
}): PurchasesAdapter {
  const eligible = opts?.eligibleForTrial !== false
  const purchases: PurchaseResult[] = []

  return {
    platform: 'web',
    async configure() {
      /* no-op */
    },
    async listOffers(): Promise<StoreOffer[]> {
      return [
        {
          offerKey: 'solo_monthly',
          productId: PRO_OFFERS.monthly.productIdApple,
          title: 'Ranked Pro Solo mensuel',
          priceString: eligible ? 'Essai 14 j puis 9,99 €' : '9,99 €',
          periodLabel: 'mois',
        },
        {
          offerKey: 'solo_yearly',
          productId: PRO_OFFERS.yearly.productIdApple,
          title: 'Ranked Pro Solo annuel',
          priceString: eligible ? 'Essai 14 j puis 89,99 €' : '89,99 €',
          periodLabel: 'an',
        },
      ]
    },
    async purchase({ offerKey, productId, appAccountToken }) {
      const ends = Date.now() + 14 * 86400000
      const originalTransactionId = `fake-orig-${appAccountToken.slice(0, 8)}`
      const transactionId = `fake-tx-${Date.now()}`
      const claims = {
        transactionId,
        originalTransactionId,
        productId,
        bundleId: 'com.rankedgym.app',
        environment: 'Xcode',
        expiresDate: ends,
        offerType: eligible ? 1 : undefined,
        offerDiscountType: eligible ? 'FREE_TRIAL' : undefined,
        appAccountToken,
        inAppOwnershipType: 'PURCHASED',
        type: 'Auto-Renewable Subscription',
      }
      const result: PurchaseResult = {
        platform: 'web',
        productId,
        signedTransaction: `localtest.${JSON.stringify(claims)}`,
        transactionId,
        grantsPro: false,
      }
      purchases.push(result)
      void offerKey
      return result
    },
    async restore() {
      return [...purchases]
    },
    async finish() {
      /* no-op */
    },
    async manageSubscriptions() {
      if (typeof window !== 'undefined') {
        window.open('https://apps.apple.com/account/subscriptions', '_blank', 'noopener')
      }
    },
  }
}
