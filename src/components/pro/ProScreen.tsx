import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  PRO_CONTENT_BULLETS,
  PRO_EXCLUDED_BULLETS,
  PRO_L05_CHECKBOX_TEXT,
  PRO_AUTO_RENEW_MENTION,
  PRO_CANCEL_LINK_LABEL,
  PRO_RESTORE_LABEL,
  PRO_MONTHLY_PRICE_LINE,
  PRO_YEARLY_PRICE_LINE,
  PRO_WEB_PURCHASE_UNAVAILABLE,
  proL05bForOffer,
} from '../../../shared/subscriptions/legalCopy'
import { PRO_LEGAL_TEXT_VERSION_L05 } from '../../../shared/subscriptions/constants'
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../legal/legalRoutes'
import { Capacitor } from '@capacitor/core'

type OfferKey = 'solo_monthly' | 'solo_yearly'

interface ProScreenProps {
  onBack: () => void
  onPrepareAndPurchase: (args: {
    offerKey: OfferKey
    withdrawalConsent: boolean
    legalVersion: string
  }) => Promise<void>
  onRestore: () => Promise<void>
  onManageSubscriptions: () => void
  purchaseAvailable: boolean
  busy?: boolean
  error?: string | null
  firstChargeHint?: string | null
  needsDateOfBirth?: boolean
  onSaveDateOfBirth?: (iso: string) => Promise<void>
  onOpenReceipt?: () => void
}

export function ProScreen({
  onBack,
  onPrepareAndPurchase,
  onRestore,
  onManageSubscriptions,
  purchaseAvailable,
  busy = false,
  error = null,
  firstChargeHint = null,
  needsDateOfBirth = false,
  onSaveDateOfBirth,
  onOpenReceipt,
}: ProScreenProps) {
  const [offerKey, setOfferKey] = useState<OfferKey>('solo_monthly')
  const [consent, setConsent] = useState(false)
  const [dob, setDob] = useState('')
  const isNative = Capacitor.isNativePlatform()
  const canBuy = purchaseAvailable && isNative && !needsDateOfBirth

  const l05b = useMemo(() => proL05bForOffer(offerKey), [offerKey])

  return (
    <div className="flex min-h-full flex-col gap-5 pb-10 ios-fade-up">
      <header className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[22px] font-bold text-white">Ranked Pro Solo</h1>
      </header>

      <p className="text-[15px] leading-snug text-[#C7C7CC]">
        Plus joli et plus confortable. Jamais d’avantage de rang, Force, Discipline ou points.
      </p>

      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
          Inclus
        </h2>
        <ul className="space-y-1.5 text-[14px] text-white">
          {PRO_CONTENT_BULLETS.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
          Exclu (anti pay-to-win)
        </h2>
        <ul className="space-y-1.5 text-[14px] text-[#C7C7CC]">
          {PRO_EXCLUDED_BULLETS.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
          Offre
        </h2>
        <div className="grid gap-2">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4">
            <input
              type="radio"
              name="pro-offer"
              checked={offerKey === 'solo_monthly'}
              onChange={() => setOfferKey('solo_monthly')}
            />
            <span className="text-[15px] text-white">{PRO_MONTHLY_PRICE_LINE}</span>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4">
            <input
              type="radio"
              name="pro-offer"
              checked={offerKey === 'solo_yearly'}
              onChange={() => setOfferKey('solo_yearly')}
            />
            <span className="text-[15px] text-white">{PRO_YEARLY_PRICE_LINE}</span>
          </label>
        </div>
        <p className="text-[13px] text-[#ACB4BA]">
          Essai gratuit 14 jours si éligible. {PRO_AUTO_RENEW_MENTION}.
        </p>
        {firstChargeHint ? (
          <p className="text-[13px] text-[#FF907F]">{firstChargeHint}</p>
        ) : null}
      </section>

      {needsDateOfBirth ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-[15px] font-semibold text-white">Date de naissance</h2>
          <p className="text-[13px] text-[#ACB4BA]">
            Requis pour acheter Pro (15 ans minimum). Pas une simple case à cocher.
          </p>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-white"
          />
          <button
            type="button"
            disabled={!dob || busy || !onSaveDateOfBirth}
            onClick={() => onSaveDateOfBirth && void onSaveDateOfBirth(dob)}
            className="ios-press min-h-11 w-full rounded-2xl bg-white text-[15px] font-semibold text-black disabled:opacity-40"
          >
            Enregistrer
          </button>
        </section>
      ) : null}

      {!purchaseAvailable || !isNative ? (
        <p className="rounded-2xl bg-white/5 px-4 py-3 text-[14px] text-[#C7C7CC]">
          {PRO_WEB_PURCHASE_UNAVAILABLE}
        </p>
      ) : needsDateOfBirth ? null : (
        <>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-[13px] leading-snug text-white">{PRO_L05_CHECKBOX_TEXT}</span>
          </label>

          <p className="text-[12px] leading-snug text-[#ACB4BA]">{l05b}</p>

          <button
            type="button"
            disabled={!consent || busy || !canBuy}
            onClick={() =>
              void onPrepareAndPurchase({
                offerKey,
                withdrawalConsent: consent,
                legalVersion: PRO_LEGAL_TEXT_VERSION_L05,
              })
            }
            className="ios-press min-h-12 w-full rounded-2xl bg-white text-[15px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Patiente…' : 'Commencer l’essai'}
          </button>
        </>
      )}

      {error ? (
        <p className="text-[13px] text-[#FF0702]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void onRestore()}
          className="ios-press min-h-11 text-left text-[15px] font-medium text-white underline"
        >
          {PRO_RESTORE_LABEL}
        </button>
        <button
          type="button"
          onClick={onManageSubscriptions}
          className="ios-press min-h-11 text-left text-[15px] font-medium text-white underline"
        >
          {PRO_CANCEL_LINK_LABEL}
        </button>
        {onOpenReceipt ? (
          <button
            type="button"
            onClick={onOpenReceipt}
            className="ios-press min-h-11 text-left text-[15px] font-medium text-white underline"
          >
            Voir mon reçu Pro
          </button>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[#ACB4BA]">
        <a href={LEGAL_TERMS_PATH} className="underline">
          CGU
        </a>
        <a href="/legal/cgv-pro" className="underline">
          CGV Pro
        </a>
        <a href={LEGAL_PRIVACY_PATH} className="underline">
          Confidentialité
        </a>
        <a href="/settings/delete-account" className="underline">
          Supprimer mon compte
        </a>
      </nav>
    </div>
  )
}
