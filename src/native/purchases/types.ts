export type PurchasePlatform = 'ios' | 'android' | 'web'

export type StoreOffer = {
  offerKey: 'solo_monthly' | 'solo_yearly'
  productId: string
  basePlanId?: string
  title: string
  priceString: string
  periodLabel: string
}

export type PurchaseResult = {
  platform: PurchasePlatform
  productId: string
  /** Apple StoreKit 2 JWS — never trust client-side alone. */
  signedTransaction?: string
  signedRenewalInfo?: string
  /** Google purchase token */
  purchaseToken?: string
  transactionId?: string
  /** True only after server verify — adapters must keep this false. */
  grantsPro: false
}

export type PurchasesAdapter = {
  platform: PurchasePlatform
  configure(): Promise<void>
  listOffers(): Promise<StoreOffer[]>
  purchase(args: {
    offerKey: 'solo_monthly' | 'solo_yearly'
    productId: string
    basePlanId?: string
    appAccountToken: string
  }): Promise<PurchaseResult>
  restore(appAccountToken?: string): Promise<PurchaseResult[]>
  finish(transactionIdOrToken: string): Promise<void>
  manageSubscriptions(productId?: string): Promise<void>
}
