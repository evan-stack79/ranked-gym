import { X } from 'lucide-react'
import { PRO_YEARLY_PRICE_LINE } from '../../../shared/subscriptions/legalCopy'

interface ProPassCardProps {
  onTryFree: () => void
  onDismiss: () => void
}

export function ProPassCard({ onTryFree, onDismiss }: ProPassCardProps) {
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
        aria-label="Fermer l’offre Ranked Pro"
        className="ios-press absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#ACB4BA] hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <p className="pr-12 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF907F]">
        Ranked Pro Solo
      </p>
      <h2 className="mt-1 pr-12 text-[22px] font-bold leading-tight text-white">
        Plus joli. Plus confortable.
      </h2>
      <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-[#C7C7CC]">
        14 jours d&apos;essai gratuit, puis 9,99&nbsp;€ / mois — ou {PRO_YEARLY_PRICE_LINE}.
        Aucun avantage de rang, Force, Discipline ou points.
      </p>
      <button
        type="button"
        onClick={onTryFree}
        className="ios-press mt-5 min-h-11 w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#000000]"
      >
        Découvrir Pro
      </button>
    </div>
  )
}
