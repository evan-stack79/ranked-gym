import type { RecentSessionItem } from '../../utils/trainHub'

interface TrainRecentSessionsProps {
  items: RecentSessionItem[]
  onOpen: (id: string) => void
  onSeeAll: () => void
}

export function TrainRecentSessions({ items, onOpen, onSeeAll }: TrainRecentSessionsProps) {
  return (
    <section aria-label="Dernières séances">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[#8E8E93]">Dernières séances</p>
        <button
          type="button"
          onClick={onSeeAll}
          className="ios-press min-h-11 rounded-xl px-2 text-[13px] font-semibold text-[#FF6961] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
        >
          Voir tout
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#141416] px-4 py-5 text-center text-[14px] text-[#8E8E93]">
          Aucune séance enregistrée
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="ios-press flex min-h-11 w-full flex-col rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold text-white">{item.title}</p>
                  <span className="shrink-0 text-[12px] text-[#636366]">{item.dateLabel}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-[#FF6961]">{item.sportLabel}</p>
                <p className="mt-1 truncate text-[13px] text-[#AEAEB2]">{item.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
