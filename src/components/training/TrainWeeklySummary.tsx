import type { SportSummaryFilter, WeeklySummary } from '../../utils/trainHub'

const FILTERS: { id: SportSummaryFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'strength', label: 'Muscu' },
  { id: 'endurance', label: 'Course' },
  { id: 'team', label: 'Foot' },
  { id: 'other', label: 'Autre' },
]

interface TrainWeeklySummaryProps {
  summary: WeeklySummary
  filter: SportSummaryFilter
  onFilterChange: (filter: SportSummaryFilter) => void
}

export function TrainWeeklySummary({
  summary,
  filter,
  onFilterChange,
}: TrainWeeklySummaryProps) {
  return (
    <section aria-label="Résumé de la semaine">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#8E8E93]">Résumé</p>
        <div
          className="flex max-w-full flex-wrap gap-1"
          role="tablist"
          aria-label="Filtrer par sport"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f.id)}
                className={`ios-press flex min-h-11 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-semibold ${
                  active
                    ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/18 text-[#FF6961]'
                    : 'border-white/10 text-[#8E8E93]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {summary.metrics.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5"
          >
            <p className="text-[11px] font-medium text-[#8E8E93]">{m.label}</p>
            <p className="mt-1 text-[24px] font-bold tabular-nums leading-none tracking-tight text-white">
              {m.display}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
