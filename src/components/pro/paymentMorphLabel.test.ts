import { describe, expect, it } from 'vitest'
import {
  PAYMENT_MORPH_DONE_LABEL,
  paymentMorphLabel,
  purchaseErrorMessage,
} from './paymentMorphLabel'
import { PRO_OFFERS } from '../../../shared/subscriptions/constants'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('paymentMorphLabel', () => {
  it('garde les prix exacts PRO_OFFERS', () => {
    expect(paymentMorphLabel('solo_monthly')).toBe(`Payer ${PRO_OFFERS.monthly.priceEurosDisplay}`)
    expect(paymentMorphLabel('solo_yearly')).toBe(`Payer ${PRO_OFFERS.yearly.priceEurosDisplay}`)
    expect(paymentMorphLabel('solo_monthly')).toBe('Payer 9,99 €')
    expect(paymentMorphLabel('solo_yearly')).toBe('Payer 89,99 €')
    expect(PAYMENT_MORPH_DONE_LABEL).toBe('Payé')
  })

  it('messages FR clairs pour annulation et échec', () => {
    expect(purchaseErrorMessage(new Error('USER_CANCELLED'))).toMatch(/annulé/i)
    expect(purchaseErrorMessage(new Error('Purchase cancelled by user'))).toMatch(/annulé/i)
    expect(purchaseErrorMessage(new Error('CLIENT_GRANT_FORBIDDEN'))).toMatch(/validé|mobile/i)
    expect(purchaseErrorMessage(new Error('boom'))).toMatch(/échoué|Réessaie/i)
  })

  it('ProScreen branche PaymentMorphButton avec disabled={!consent', () => {
    const ui = readFileSync(resolve(__dirname, './ProScreen.tsx'), 'utf8')
    expect(ui).toMatch(/PaymentMorphButton/)
    expect(ui).toMatch(/disabled=\{!consent/)
    expect(ui).not.toMatch(/Commencer l’essai/)
  })

  it('PaymentMorphButton : idle rouge, succès Payé vert #16a34a', () => {
    const src = readFileSync(resolve(__dirname, './PaymentMorphButton.tsx'), 'utf8')
    expect(src).toContain("'#ff0702'")
    expect(src).toContain("'#16a34a'")
    expect(src).toMatch(/--dissolve-primary/)
    expect(src).toMatch(/--dissolve-success/)
  })
})
