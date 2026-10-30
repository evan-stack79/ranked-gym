import { X } from 'lucide-react'

const BENEFITS = [
  'classements illimités',
  'duels sans publicité',
  'statistiques détaillées',
] as const

interface ProPassCardProps {
  onTryFree: () => void
  onDismiss: () => void
  onViewFreeOffer?: () => void
}

export function ProPassCard({ onTryFree, onDismiss, onViewFreeOffer }: ProPassCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#FF0702]/25 p-5"
      style={{
        background:
          'linear-gradient(135deg, rgb(18 18 20) 0%, rgb(28 12 14) 45%, rgb(80 18 22) 100%)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l’offre Passe Pro"
        className="ios-press absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#ACB4BA] hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <h2 className="pr-12 text-[22px] font-bold leading-tight text-white">Passe Pro</h2>
      <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-[#C7C7CC]">
        7 jours d&apos;essai gratuit, ensuite 9,99 euros par mois, résiliable à tout moment
      </p>
      <ul className="mt-4 space-y-1.5 text-[14px] leading-snug text-[#C7C7CC]">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <span aria-hidden className="text-[#FF907F]">
              ·
            </span>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onTryFree}
        className="ios-press mt-5 min-h-11 w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#000000]"
      >
        Essayer gratuitement
      </button>
      <button
        type="button"
        onClick={onViewFreeOffer}
        className="ios-press mt-2 min-h-11 w-full py-2.5 text-center text-[14px] font-medium text-[#ACB4BA] hover:text-white"
      >
        Voir l&apos;offre gratuite
      </button>
    </div>
  )
}
