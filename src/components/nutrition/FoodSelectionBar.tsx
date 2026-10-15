import { Check } from 'lucide-react'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import { cleanupFoodName } from '../../utils/foodDisplay'
import { OffProductImage } from './OffProductImage'

interface FoodSelectionBarProps {
  selected: OpenFoodFactsSearchHit[]
  onValidate: () => void
  forceOfflineImages?: boolean
}

/**
 * Barre flottante verre : « N aliments choisis » + miniatures + valider rouge.
 * Pas de total kcal.
 */
export function FoodSelectionBar({
  selected,
  onValidate,
  forceOfflineImages = false,
}: FoodSelectionBarProps) {
  if (selected.length === 0) return null
  const n = selected.length
  const label = n === 1 ? '1 aliment choisi' : `${n} aliments choisis`
  const thumbs = selected.slice(0, 4)

  return (
    <div
      data-food-selection-bar
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/12 px-3.5 py-3"
        style={{
          background: 'rgb(28 28 30 / 0.72)',
          backdropFilter: 'blur(18px) saturate(1.35)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.35)',
          boxShadow: '0 12px 40px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.08)',
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex -space-x-2">
            {thumbs.map((hit) => (
              <div
                key={`${hit.barcode}-${hit.nom}`}
                className="overflow-hidden rounded-full border border-[#1C1C1E] bg-[#2C2C2E]"
              >
                <OffProductImage
                  src={hit.imageUrl}
                  alt={cleanupFoodName(hit.nom)}
                  size={28}
                  forceFallback={forceOfflineImages}
                />
              </div>
            ))}
          </div>
          <p className="truncate text-[13px] font-semibold text-white">{label}</p>
        </div>
        <button
          type="button"
          onClick={onValidate}
          aria-label="Valider la sélection"
          className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B] text-white"
        >
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  )
}
