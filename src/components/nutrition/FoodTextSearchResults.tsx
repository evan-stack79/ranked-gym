import { Loader2 } from 'lucide-react'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

interface FoodTextSearchResultsProps {
  query: string
  loading: boolean
  error: string | null
  hits: OpenFoodFactsSearchHit[]
  onSelect: (hit: OpenFoodFactsSearchHit) => void
}

export function FoodTextSearchResults({
  query,
  loading,
  error,
  hits,
  onSelect,
}: FoodTextSearchResultsProps) {
  if (query.trim().length < 2) return null

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {loading ? (
        <div className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-[#8E8E93]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Recherche Open Food Facts…
        </div>
      ) : null}

      {error && !loading ? (
        <p className="px-3.5 py-3 text-[13px] text-[#FF6961]">{error}</p>
      ) : null}

      {!loading && !error && hits.length === 0 ? (
        <p className="px-3.5 py-3 text-[13px] text-[#8E8E93]">Aucun produit trouvé.</p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="max-h-64 divide-y divide-white/8 overflow-y-auto overscroll-contain">
          {hits.map((hit) => (
            <li key={`${hit.barcode}-${hit.nom}`}>
              <button
                type="button"
                onClick={() => onSelect(hit)}
                className="ios-press flex w-full items-start gap-3 px-3.5 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-white">{hit.nom}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8E8E93]">
                    {hit.brands || 'Marque inconnue'}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#FF9F0A]">
                  {hit.calories}
                  <span className="ml-0.5 text-[11px] font-medium text-[#8E8E93]">kcal/100g</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
