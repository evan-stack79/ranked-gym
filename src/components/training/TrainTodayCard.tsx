import { TRAIN_CTA_LABELS, type TodayHubCard } from '../../utils/trainHub'

interface TrainTodayCardProps {
  card: TodayHubCard
  onPrimary: () => void
}

/**
 * Carte principale Aujourd’hui — un seul CTA dominant.
 */
export function TrainTodayCard({ card, onPrimary }: TrainTodayCardProps) {
  const isPrimaryRed =
    card.cta === 'resume' || card.cta === 'start' || card.cta === 'choose_activity'
  const label = TRAIN_CTA_LABELS[card.cta]

  return (
    <section
      className="train-hub-card rounded-3xl border border-white/10 bg-[#141416] p-5"
      aria-label="Aujourd’hui"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
        Aujourd’hui
      </p>
      <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-white">
        {card.title}
      </h2>
      <p className="mt-1 text-[14px] font-medium text-[#FF6961]">{card.sportLabel}</p>
      {card.summaryLine ? (
        <p className="mt-2 truncate text-[14px] leading-snug text-[#AEAEB2]">
          {card.summaryLine}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onPrimary}
        aria-label={label}
        className={
          isPrimaryRed
            ? 'btn-brand ios-press mt-5 flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60'
            : 'ios-press mt-5 flex min-h-11 w-full items-center justify-center rounded-2xl border border-[#FF2B2B]/30 bg-white/5 px-4 py-3.5 text-[16px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35'
        }
      >
        {label}
      </button>
    </section>
  )
}
