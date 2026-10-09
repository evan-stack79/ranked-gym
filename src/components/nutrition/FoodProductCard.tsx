import { Check, Plus } from 'lucide-react'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import { cleanupFoodName, formatOffServingSize } from '../../utils/foodDisplay'
import { OffProductImage } from './OffProductImage'

interface FoodProductCardProps {
  hit: OpenFoodFactsSearchHit
  selected: boolean
  onToggle: () => void
  forceOfflineImages?: boolean
}

/**
 * Carte produit 2-colonnes : photo flottante, nom, pill portion, + / check.
 * Contenu : photo + name + portion UNIQUEMENT (pas de kcal, Nutri-Score, prix…).
 */
export function FoodProductCard({
  hit,
  selected,
  onToggle,
  forceOfflineImages = false,
}: FoodProductCardProps) {
  const name = cleanupFoodName(hit.nom)
  const portion = formatOffServingSize(hit.servingSize)

  return (
    <article
      data-food-card
      data-selected={selected ? 'true' : 'false'}
      className={`relative flex flex-col rounded-[22px] border bg-[#1A1A1C] pt-10 pb-3.5 px-3 transition-[border-color,box-shadow] ${
        selected
          ? 'border-[#FF2B2B] shadow-[0_0_0_1px_rgb(255_43_43_/_0.35)]'
          : 'border-white/[0.08]'
      }`}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[42%]">
        <OffProductImage
          src={hit.imageUrl}
          alt=""
          size={88}
          forceFallback={forceOfflineImages}
        />
      </div>

      <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-center text-[13px] font-semibold leading-snug tracking-tight text-white">
        {name}
      </h3>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          data-portion-pill
          className="max-w-[70%] truncate rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#AEAEB2]"
        >
          {portion}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? `Retirer ${name}` : `Choisir ${name}`}
          aria-pressed={selected}
          className={`ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            selected
              ? 'bg-white text-[#FF2B2B]'
              : 'bg-[#FF2B2B] text-white'
          }`}
        >
          {selected ? (
            <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
          )}
        </button>
      </div>
    </article>
  )
}
