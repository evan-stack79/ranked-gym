import { ChevronRight, Trophy } from 'lucide-react'
import { CLASSEMENT_TITLE } from '../../lib/gymLeaderboard/texts'

/** Train hub entry — matches mockup « Classement de ma salle » card. */
export function GymLeaderboardEntryCard({
  gymLabel,
  onOpen,
}: {
  gymLabel?: string | null
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-classement-entry-card
      className="ios-press flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35"
      aria-label={CLASSEMENT_TITLE}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B]/15 text-[#FF2B2B]"
        aria-hidden="true"
      >
        <Trophy className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-white">{CLASSEMENT_TITLE}</span>
        {gymLabel ? (
          <span className="mt-0.5 block truncate text-[13px] text-[#AEAEB2]">{gymLabel}</span>
        ) : (
          <span className="mt-0.5 block text-[13px] text-[#8E8E93]">Rejoindre le classement</span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#636366]" aria-hidden="true" />
    </button>
  )
}
