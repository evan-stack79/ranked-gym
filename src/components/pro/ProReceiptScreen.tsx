import { ChevronLeft } from 'lucide-react'
import { PRO_CANCEL_LINK_LABEL, PRO_L05_CHECKBOX_TEXT } from '../../../shared/subscriptions/legalCopy'

export type ProReceiptView = {
  offerKey: string
  productId: string
  priceDisplay: string
  firstChargeAt: number | null
  firstChargeAmountDisplay: string
  withdrawalConsentAt: number
  legalVersionL05: string
  cancelUrl: string
  createdAt: number
}

interface ProReceiptScreenProps {
  receipt: ProReceiptView
  onBack: () => void
}

/** Confirmation durable sauvegardable (PRO-L05d / CA-PRO25). */
export function ProReceiptScreen({ receipt, onBack }: ProReceiptScreenProps) {
  return (
    <div className="flex min-h-full flex-col gap-4 pb-10 ios-fade-up">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[20px] font-bold text-white">Reçu Ranked Pro</h1>
      </header>

      <p className="text-[13px] text-[#ACB4BA]">
        Conserve cette page (capture ou impression) — confirmation sur support durable.
      </p>

      <dl className="space-y-3 text-[14px] text-white">
        <div>
          <dt className="text-[#ACB4BA]">Offre</dt>
          <dd>
            {receipt.offerKey} — {receipt.productId}
          </dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">Prix</dt>
          <dd>{receipt.priceDisplay}</dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">1er prélèvement</dt>
          <dd>
            {receipt.firstChargeAmountDisplay}
            {receipt.firstChargeAt
              ? ` — ${new Date(receipt.firstChargeAt).toISOString()}`
              : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">Renonciation cochée</dt>
          <dd>
            {new Date(receipt.withdrawalConsentAt).toISOString()} (version{' '}
            {receipt.legalVersionL05})
          </dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">Texte de la case</dt>
          <dd className="text-[13px] leading-snug text-[#C7C7CC]">{PRO_L05_CHECKBOX_TEXT}</dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">{PRO_CANCEL_LINK_LABEL}</dt>
          <dd>
            <a href={receipt.cancelUrl} className="underline" target="_blank" rel="noreferrer">
              {receipt.cancelUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[#ACB4BA]">Émis le</dt>
          <dd>{new Date(receipt.createdAt).toISOString()}</dd>
        </div>
      </dl>
    </div>
  )
}
