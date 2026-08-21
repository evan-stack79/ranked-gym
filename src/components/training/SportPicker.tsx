import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { searchSports, SPORT_CATEGORY_LABELS, getSportById } from '../../data/sports'
import type { Sport } from '../../types/training'
import { IosSheet } from '../ui/IosSheet'

interface SportPickerProps {
  open: boolean
  selectedId: string | null
  onClose: () => void
  onSelect: (sport: Sport) => void
}

export function SportPicker({ open, selectedId, onClose, onSelect }: SportPickerProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSports(query).slice(0, 80), [query])

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Ton sport"
      subtitle="Les plus connus d’abord — cherche le tien"
    >
      <div className="space-y-3 pb-2">
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3.5 py-3">
          <Search className="h-4 w-4 text-[#8E8E93]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex. tennis, musculation, trail…"
            className="w-full bg-transparent text-[15px] text-white placeholder:text-[#636366] outline-none"
            autoFocus
          />
        </label>

        <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {results.map((sport) => {
            const active = sport.id === selectedId
            return (
              <li key={sport.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(sport)
                    onClose()
                  }}
                  className={`ios-press flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                    active
                      ? 'border-[#30D158]/40 bg-[#30D158]/15'
                      : 'border-white/10 bg-black/25'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">{sport.name}</p>
                    <p className="text-[11px] text-[#8E8E93]">
                      {SPORT_CATEGORY_LABELS[sport.category]}
                    </p>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-[#30D158]" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </IosSheet>
  )
}

export function SportChip({ sportId }: { sportId: string | null }) {
  const sport = sportId ? getSportById(sportId) : getSportById('musculation')
  if (!sport) return <span>Musculation / Hypertrophie</span>
  return <span>{sport.name}</span>
}
