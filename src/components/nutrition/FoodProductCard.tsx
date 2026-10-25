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
 * Carte produit 2-colonnes : photo au-dessus du nom (pas de chevauchement),
 * portion lisible (pas de truncate agressif), + / check.
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
      className={`flex flex-col rounded-[22px] border bg-[#1A1A1C] px-2.5 pb-3 pt-3 transition-[border-color,box-shadow] ${
        selected
          ? 'border-[#FF0702] shadow-[0_0_0_1px_rgb(255_7_2_/_0.35)]'
          : 'border-white/[0.08]'
      }`}
    >
      <div className="mx-auto flex h-[72px] w-[72px] shrink-0 items-center justify-center">
        <OffProductImage
          src={hit.imageUrl}
          alt=""
          size={72}
          forceFallback={forceOfflineImages}
          barcode={hit.barcode}
          productName={hit.nom}
        />
      </div>

      <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] break-words text-center text-[13px] font-semibold leading-snug tracking-tight text-white">
        {name}
      </h3>

      <div className="mt-2 flex min-w-0 items-end justify-between gap-1.5">
        <span
          data-portion-pill
          className="min-w-0 flex-1 whitespace-normal break-words rounded-full bg-white/[0.08] px-2 py-1 text-left text-[10px] font-medium leading-snug text-[#ACB4BA] sm:text-[11px]"
        >
          {portion}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? `Retirer ${name}` : `Choisir ${name}`}
          aria-pressed={selected}
          className="ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF0702] text-white"
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
