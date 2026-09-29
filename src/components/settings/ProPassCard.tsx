import { X } from 'lucide-react'
import { BorderBeamPanel } from '../ui/border-beam-panel'

interface ProPassCardProps {
  onTryFree: () => void
  onDismiss: () => void
}

export function ProPassCard({ onTryFree, onDismiss }: ProPassCardProps) {
  return (
    <BorderBeamPanel
      className="overflow-visible border-transparent p-5"
      style={{
        background:
          'linear-gradient(135deg, rgb(18 18 20) 0%, rgb(28 12 14) 45%, rgb(80 18 22) 100%)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
      beams={2}
      colors={['#FF2B2B', '#FFB4A8']}
      thickness={2}
      radius={24}
      glow
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l’offre Pass Pro"
        className="ios-press absolute right-2 top-2 z-[1] flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#AEAEB2] hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <p className="pr-12 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF6961]">
        Pass Pro
      </p>
      <h2 className="mt-1 pr-12 text-[22px] font-bold leading-tight text-white">
        Débloque le Pass Pro
      </h2>
      <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-[#C7C7CC]">
        Toutes les fonctionnalités débloquées. 7 jours d&apos;essai gratuit, puis 6,99&nbsp;€ /
        mois.
      </p>
      <button
        type="button"
        onClick={onTryFree}
        className="ios-press mt-5 min-h-11 w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#0C0C0E]"
      >
        Essayer gratuitement
      </button>
    </BorderBeamPanel>
  )
}
