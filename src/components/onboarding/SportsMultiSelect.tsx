import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchSports, SPORT_CATEGORY_LABELS } from '../../data/sports'
import type { Sport } from '../../types/training'

interface SportsMultiSelectProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  idPrefix?: string
}

export function SportsMultiSelect({
  selectedIds,
  onChange,
  idPrefix = 'sport',
}: SportsMultiSelectProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSports(query), [query])
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const selectedFromCatalog = useMemo(() => {
    const byId = new Map(searchSports('').map((s) => [s.id, s]))
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as Sport[]
  }, [selectedIds])

  const toggle = (sport: Sport) => {
    const current = selectedIdsRef.current
    const next = current.includes(sport.id)
      ? current.filter((id) => id !== sport.id)
      : [...current, sport.id]
    selectedIdsRef.current = next
    onChange(next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-sports-multi-select>
      <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#141416] px-3.5">
        <Search className="h-4 w-4 text-[#8E8E93]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un sport"
          aria-label="Rechercher un sport"
          className="min-h-11 w-full bg-transparent text-[15px] text-white placeholder:text-[#636366] outline-none"
        />
      </label>

      {selectedFromCatalog.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sports sélectionnés">
          {selectedFromCatalog.map((sport) => (
            <li key={sport.id}>
              <button
                type="button"
                onClick={() => toggle(sport)}
                className="ios-press flex min-h-11 items-center gap-1.5 rounded-full border border-white/12 bg-[#1c1c1e] px-3 text-[13px] font-semibold text-white"
                aria-label={`Retirer ${sport.name}`}
              >
                {sport.name}
                <X className="h-3.5 w-3.5 text-[#8E8E93]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ul
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Catalogue de sports"
        id={`${idPrefix}-list`}
      >
        {results.map((sport) => {
          const active = selectedIds.includes(sport.id)
          return (
            <li key={sport.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={active}
                id={`${idPrefix}-${sport.id}`}
                onClick={() => toggle(sport)}
                className={`ios-press flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                  active
                    ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/12'
                    : 'border-white/10 bg-[#141416]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-white">
                    {sport.name}
                  </span>
                  <span className="block text-[11px] text-[#8E8E93]">
                    {SPORT_CATEGORY_LABELS[sport.category]}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    active ? 'border-[#FF2B2B] bg-[#FF2B2B] text-white' : 'border-white/20'
                  }`}
                  aria-hidden="true"
                >
                  {active ? '✓' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {results.length === 0 && query ? (
        <p className="text-[13px] text-[#8E8E93]">Aucun sport ne correspond à cette recherche.</p>
      ) : null}
    </div>
  )
}
