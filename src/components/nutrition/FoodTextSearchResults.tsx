import { Loader2, Search } from 'lucide-react'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

interface FoodTextSearchResultsProps {
  query: string
  loading: boolean
  error: string | null
  hits: OpenFoodFactsSearchHit[]
  onSelect: (hit: OpenFoodFactsSearchHit) => void
  onRetry?: () => void
  /** Liste en flex-1 : occupe tout l’espace restant sous la barre de recherche. */
  fill?: boolean
}

export function FoodTextSearchResults({
  query,
  loading,
  error,
  hits,
  onSelect,
  onRetry,
  fill = false,
}: FoodTextSearchResultsProps) {
  const trimmed = query.trim()
  const idle = trimmed.length < 2

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40 ${
        fill ? 'h-full' : ''
      }`}
      data-food-search-state={
        idle ? 'idle' : loading ? 'loading' : error ? 'error' : hits.length === 0 ? 'empty' : 'results'
      }
    >
      {idle ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Search className="h-6 w-6 text-[#636366]" strokeWidth={1.75} aria-hidden />
          <p className="text-[14px] font-medium text-[#8E8E93]">
            Tape un aliment ou une marque
          </p>
          <p className="text-[12px] text-[#636366]">Résultats Open Food Facts (France)</p>
        </div>
      ) : null}

      {!idle && loading ? (
        <div
          className={`flex items-center gap-2 px-3.5 py-3 text-[13px] text-[#8E8E93] ${
            hits.length === 0 ? 'min-h-0 flex-1 justify-center' : ''
          }`}
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Recherche Open Food Facts…
        </div>
      ) : null}

      {!idle && error && !loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-3.5 py-4">
          <p className="text-[13px] text-[#FF6961]">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="ios-press rounded-xl border border-white/12 bg-[#1c1c1e] px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}

      {!idle && !loading && !error && hits.length === 0 ? (
        <p className="flex min-h-0 flex-1 items-center px-3.5 py-3 text-[13px] text-[#8E8E93]">
          Aucun produit trouvé.
        </p>
      ) : null}

      {!idle && hits.length > 0 ? (
        <ul
          className={`min-h-0 divide-y divide-white/8 overflow-y-auto overscroll-contain ${
            fill ? 'flex-1' : 'max-h-72'
          }`}
          role="listbox"
          aria-label="Résultats Open Food Facts"
        >
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
