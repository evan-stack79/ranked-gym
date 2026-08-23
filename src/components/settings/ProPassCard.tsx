import { X } from 'lucide-react'

interface ProPassCardProps {
  onTryFree: () => void
  onDismiss: () => void
}

export function ProPassCard({ onTryFree, onDismiss }: ProPassCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#FF2B2B]/25 p-5"
      style={{
        background:
          'linear-gradient(135deg, rgb(18 18 20) 0%, rgb(28 12 14) 45%, rgb(80 18 22) 100%)',
        boxShadow: '0 12px 40px rgb(255 43 43 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l’offre Pass Pro"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#8E8E93] transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <p className="pr-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF6961]">
        Pass Pro
      </p>
      <h2 className="mt-1 pr-6 text-[22px] font-bold leading-tight text-white">
        Débloque le Pass Pro
      </h2>
      <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-[#C7C7CC]">
        Toutes les fonctionnalités débloquées. 7 jours d&apos;essai gratuit, puis 6,99&nbsp;€ /
        mois.
      </p>
      <button
        type="button"
        onClick={onTryFree}
        className="ios-press mt-5 w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#0C0C0E] shadow-[0_4px_20px_rgb(0_0_0_/0.25)]"
      >
        Essayer gratuitement
      </button>
    </div>
  )
}
