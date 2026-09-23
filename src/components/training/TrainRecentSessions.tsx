import type { RecentSessionItem } from '../../utils/trainHub'

interface TrainRecentSessionsProps {
  items: RecentSessionItem[]
  onOpen: (id: string) => void
  onSeeAll: () => void
  /** Accueil maquette : une seule séance, sans « Voir tout ». */
  single?: boolean
}

export function TrainRecentSessions({
  items,
  onOpen,
  onSeeAll,
  single = false,
}: TrainRecentSessionsProps) {
  const visible = single ? items.slice(0, 1) : items

  return (
    <section aria-label={single ? 'Dernière séance' : 'Dernières séances'}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[#8E8E93]">
          {single ? 'Dernière séance' : 'Dernières séances'}
        </p>
        {single ? null : (
          <button
            type="button"
            onClick={onSeeAll}
            className="ios-press min-h-11 rounded-xl px-2 text-[13px] font-semibold text-[#FF6961] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
          >
            Voir tout
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93]">Aucune séance enregistrée</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                data-last-session={item.id}
                className="ios-press flex min-h-11 w-full flex-col border-t border-white/10 px-0 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold text-white">{item.title}</p>
                  <span className="shrink-0 text-[12px] text-[#636366]">{item.dateLabel}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#8E8E93]">{item.sportLabel}</p>
                <p className="mt-1 truncate text-[13px] text-[#AEAEB2]">{item.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
