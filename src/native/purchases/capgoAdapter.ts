/**
 * Adaptateur Capgo `@capgo/native-purchases` (MPL-2.0).
 * autoFinishTransactions=false — finalisation après validation Convex.
 * Le SDK ne donne JAMAIS Pro seul (PRO-S02).
 */
import { Capacitor } from '@capacitor/core'
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases'
import { PRO_OFFERS } from '../../../shared/subscriptions/constants'
import type { PurchasesAdapter, PurchaseResult, StoreOffer } from './types'

function mapOfferKey(productId: string, basePlanId?: string): 'solo_monthly' | 'solo_yearly' {
  if (
    productId === PRO_OFFERS.yearly.productIdApple ||
    basePlanId === PRO_OFFERS.yearly.basePlanIdGoogle
  ) {
    return 'solo_yearly'
  }
  return 'solo_monthly'
}

export function createCapgoPurchasesAdapter(): PurchasesAdapter {
  const platform = Capacitor.getPlatform() === 'android' ? 'android' : 'ios'

  return {
    platform,
    async configure() {
      await NativePurchases.configure({ autoFinishTransactions: false })
    },
    async listOffers(): Promise<StoreOffer[]> {
      const { isBillingSupported } = await NativePurchases.isBillingSupported()
      if (!isBillingSupported) return []

      if (platform === 'ios') {
        const { products } = await NativePurchases.getProducts({
          productIdentifiers: [
            PRO_OFFERS.monthly.productIdApple,
            PRO_OFFERS.yearly.productIdApple,
          ],
          productType: PURCHASE_TYPE.SUBS,
        })
        return products.map((p) => {
          const offerKey = mapOfferKey(p.identifier)
          return {
            offerKey,
            productId: p.identifier,
            title: p.title,
            priceString: p.priceString,
            periodLabel: offerKey === 'solo_yearly' ? 'an' : 'mois',
          }
        })
      }

      // Android: one subscription product, two base plans
      const { products } = await NativePurchases.getProducts({
        productIdentifiers: [PRO_OFFERS.monthly.productIdGoogle],
        productType: PURCHASE_TYPE.SUBS,
      })
      const product = products[0]
      if (!product) return []
      return [
        {
          offerKey: 'solo_monthly',
          productId: product.identifier,
          basePlanId: PRO_OFFERS.monthly.basePlanIdGoogle,
          title: `${product.title} (mensuel)`,
          priceString: product.priceString,
          periodLabel: 'mois',
        },
        {
          offerKey: 'solo_yearly',
          productId: product.identifier,
          basePlanId: PRO_OFFERS.yearly.basePlanIdGoogle,
          title: `${product.title} (annuel)`,
          priceString: product.priceString,
          periodLabel: 'an',
        },
      ]
    },
    async purchase({ productId, basePlanId, appAccountToken }) {
      const tx = await NativePurchases.purchaseProduct({
        productIdentifier: productId,
        productType: PURCHASE_TYPE.SUBS,
        planIdentifier: basePlanId,
        appAccountToken,
        autoAcknowledgePurchases: false,
      })
      const result: PurchaseResult = {
        platform,
        productId: tx.productIdentifier,
        signedTransaction: tx.jwsRepresentation,
        purchaseToken: tx.purchaseToken,
        transactionId: tx.transactionId,
        grantsPro: false,
      }
      return result
    },
    async restore(appAccountToken) {
      await NativePurchases.restorePurchases()
      const { purchases } = await NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.SUBS,
        appAccountToken,
      })
      return purchases.map((tx) => ({
        platform,
        productId: tx.productIdentifier,
        signedTransaction: tx.jwsRepresentation,
        purchaseToken: tx.purchaseToken,
        transactionId: tx.transactionId,
        grantsPro: false as const,
      }))
    },
    async finish(transactionIdOrToken) {
      if (platform === 'ios') {
        await NativePurchases.finishTransaction({ transactionId: transactionIdOrToken })
      } else {
        await NativePurchases.acknowledgePurchase({ purchaseToken: transactionIdOrToken })
      }
    },
    async manageSubscriptions(productId) {
      if (platform === 'ios') {
        // Capgo may expose management sheet in later versions; fallback URL.
        window.open('https://apps.apple.com/account/subscriptions', '_blank', 'noopener')
        return
      }
      const pkg = 'com.rankedgym.app'
      const sku = productId ?? PRO_OFFERS.monthly.productIdGoogle
      window.open(
        `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=${encodeURIComponent(pkg)}`,
        '_blank',
        'noopener',
      )
    },
  }
}
