import { PRO_OFFERS } from '../../../shared/subscriptions/constants'

export type PayOfferKey = 'solo_monthly' | 'solo_yearly'

/** Libellé idle exact — prix déjà affiché sur l’offre (PRO_OFFERS). */
export function paymentMorphLabel(offerKey: PayOfferKey): string {
  const price =
    offerKey === 'solo_yearly'
      ? PRO_OFFERS.yearly.priceEurosDisplay
      : PRO_OFFERS.monthly.priceEurosDisplay
  return `Payer ${price}`
}

export const PAYMENT_MORPH_DONE_LABEL = 'Payé'

/** Messages FR clairs pour échec / annulation store (UI uniquement). */
export function purchaseErrorMessage(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).trim()
  if (/cancel|annul|user.?cancel|purchase.?cancel|SKErrorPaymentCancelled|BillingResponse\.USER_CANCELED/i.test(raw)) {
    return 'Paiement annulé. Aucun débit n’a été effectué.'
  }
  if (/CLIENT_GRANT_FORBIDDEN|MISSING_APPLE_PROOF|MISSING_GOOGLE_PROOF/i.test(raw)) {
    return 'Le paiement n’a pas pu être validé. Réessaie depuis l’app mobile.'
  }
  if (/UNDERAGE|DATE.?DE.?NAISSANCE|dob/i.test(raw)) {
    return 'Achat impossible : vérifie ta date de naissance (15 ans minimum).'
  }
  // Messages déjà rédigés en français par le container / la couche UI.
  if (
    /paiement|achat|disponible|annulé|échoué|naissance|store|réessaie/i.test(raw) &&
    /[àâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇ]|\s/.test(raw)
  ) {
    return raw
  }
  return 'Le paiement a échoué. Réessaie ou vérifie ton compte App Store / Google Play.'
}
