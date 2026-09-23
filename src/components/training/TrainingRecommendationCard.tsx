import { resolvePickerIllustrationSrc } from '../../utils/exercisePickerIllustrations'
import { formatExerciseMuscles } from '../../utils/exerciseMedia'
import { getCatalogExercise } from '../../data/exerciseCatalog'
import type { TrainingRecommendation } from '../../training-engine'

interface TrainingRecommendationCardProps {
  recommendation: TrainingRecommendation
  primaryLabel: 'add' | 'start'
  onPrimary: () => void
  onDismiss: () => void
  /** Nombre de séries du dernier log réel — null si non calculable. */
  setCount?: number | null
}

/**
 * Hero reco unique — photo locale par id canonique, texte 100 % dynamique.
 * Fondu noir inférieur uniquement (lisibilité), pas de glass / glow.
 */
export function TrainingRecommendationCard({
  recommendation,
  primaryLabel,
  onPrimary,
  onDismiss,
  setCount = null,
}: TrainingRecommendationCardProps) {
  const catalog = getCatalogExercise(recommendation.canonicalExerciseId)
  const imageSrc = resolvePickerIllustrationSrc(recommendation.canonicalExerciseId)
  const muscleLine = formatExerciseMuscles(catalog?.muscles ?? [])
  const cta =
    primaryLabel === 'start' ? 'Commencer avec cet exercice' : 'Ajouter à ma séance'
  const metaParts: string[] = []
  if (typeof setCount === 'number' && setCount > 0) {
    metaParts.push(`${setCount} série${setCount > 1 ? 's' : ''}`)
  }
  if (recommendation.durationMin != null) {
    metaParts.push(`${recommendation.durationMin} min`)
  }

  return (
    <section
      className="overflow-hidden rounded-3xl border border-white/10 bg-[#141416]"
      data-training-reco
      data-training-reco-slot={recommendation.slot}
      data-canonical-exercise={recommendation.canonicalExerciseId}
      data-reco-name={recommendation.name}
      data-reco-reason={recommendation.reasonText}
      data-hero-image={imageSrc ? 'ready' : 'fallback'}
      aria-label={recommendation.name}
    >
      <div className="relative isolate min-h-[220px] bg-[#1c1c1e]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1c1c1e]" data-picker-thumb-fallback />
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="relative z-[1] flex min-h-[220px] flex-col justify-end px-4 pb-4 pt-16">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-white">
            {recommendation.name}
          </h2>
          {muscleLine ? (
            <p className="mt-1 text-[13px] font-medium text-[#AEAEB2]">{muscleLine}</p>
          ) : null}
          <p className="mt-2 text-[14px] leading-snug text-[#E5E5EA]">{recommendation.reasonText}</p>
          {metaParts.length > 0 ? (
            <p className="mt-1 text-[12px] tabular-nums text-[#8E8E93]">{metaParts.join(' · ')}</p>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={onPrimary}
          className="ios-press flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#FF2B2B] px-4 text-[16px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60"
        >
          {cta}
        </button>
        {primaryLabel === 'start' ? (
          <p className="mt-2 text-center text-[12px] leading-snug text-[#8E8E93]">
            Tu pourras compléter ta séance ensuite
          </p>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="ios-press mt-1 flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-[13px] font-medium text-[#8E8E93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          Pas pour moi
        </button>
      </div>
    </section>
  )
}
