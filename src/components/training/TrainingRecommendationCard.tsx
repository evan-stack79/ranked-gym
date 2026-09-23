import { ExercisePickerThumb } from './ExercisePickerThumb'
import type { TrainingRecommendation } from '../../training-engine'

interface TrainingRecommendationCardProps {
  recommendation: TrainingRecommendation
  primaryLabel: 'add' | 'start'
  onPrimary: () => void
  onDismiss: () => void
}

const SLOT_LABEL: Record<TrainingRecommendation['slot'], string> = {
  redo: 'À refaire',
  discover: 'À découvrir',
}

/**
 * Carte reco accueil Training — visuel local, justification réelle, CTA unique.
 * Pas de stats inventées, pas d’URL distante.
 */
export function TrainingRecommendationCard({
  recommendation,
  primaryLabel,
  onPrimary,
  onDismiss,
}: TrainingRecommendationCardProps) {
  const cta = primaryLabel === 'start' ? 'Commencer' : 'Ajouter à ma séance'

  return (
    <section
      className="rounded-3xl border border-white/10 bg-[#141416] p-4"
      data-training-reco
      data-training-reco-slot={recommendation.slot}
      data-canonical-exercise={recommendation.canonicalExerciseId}
      aria-label={`${SLOT_LABEL[recommendation.slot]} : ${recommendation.name}`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
        {SLOT_LABEL[recommendation.slot]}
      </p>

      <div className="mt-3 flex items-start gap-3">
        <ExercisePickerThumb canonicalExerciseId={recommendation.canonicalExerciseId} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-bold leading-tight tracking-tight text-white">
            {recommendation.name}
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-[#AEAEB2]">{recommendation.reasonText}</p>
          {recommendation.durationMin != null ? (
            <p className="mt-1 text-[12px] tabular-nums text-[#8E8E93]">
              {recommendation.durationMin} min
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="btn-brand ios-press flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60"
        >
          {cta}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="ios-press flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-[13px] font-medium text-[#8E8E93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          Pas pour moi
        </button>
      </div>
    </section>
  )
}
