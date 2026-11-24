import type { CSSProperties } from 'react'
import { MorphButton } from '../dissolve/morph-button'
import { PAYMENT_MORPH_DONE_LABEL, paymentMorphLabel, type PayOfferKey } from './paymentMorphLabel'

const BRAND_STYLE: CSSProperties = {
  // Ranked DA — rouge / blanc uniquement (pas de vert dissolve).
  ['--dissolve-primary' as string]: '#ff0702',
  ['--dissolve-success' as string]: '#ff0702',
  ['--dissolve-primary-foreground' as string]: '#ffffff',
}

interface PaymentMorphButtonProps {
  offerKey: PayOfferKey
  onPay: () => Promise<unknown> | void
  /** Mirror of former `<button disabled={!consent …}>` gate. */
  disabled?: boolean
  className?: string
  /** Stay on « Payé » when 0. Default 2200. */
  resetAfter?: number
}

/**
 * Bouton de paiement Ranked : MorphButton dissolve, textes FR, DA rouge/noir/blanc.
 * Ne change pas la logique d’achat — `onPay` reste le même flux store.
 */
export function PaymentMorphButton({
  offerKey,
  onPay,
  disabled = false,
  className = 'w-full',
  resetAfter = 2200,
}: PaymentMorphButtonProps) {
  return (
    <MorphButton
      label={paymentMorphLabel(offerKey)}
      doneLabel={PAYMENT_MORPH_DONE_LABEL}
      onPress={onPay}
      disabled={disabled}
      height={48}
      resetAfter={resetAfter}
      haptics={false}
      className={className}
      style={BRAND_STYLE}
      labelClassName="text-[15px] font-semibold"
    />
  )
}
