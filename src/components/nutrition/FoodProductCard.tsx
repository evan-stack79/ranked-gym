import { Check } from 'lucide-react'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import { cleanupFoodName, formatOffServingSize } from '../../utils/foodDisplay'
import { resolveFoodIconCategory } from '../../utils/foodIconCategory'
import { FoodCategoryIcon } from './FoodCategoryIcon'

interface FoodProductCardProps {
  hit: OpenFoodFactsSearchHit
  selected: boolean
  onToggle: () => void
  /** Conservé pour compat tests — les photos OFF ne s’affichent plus en V3. */
  forceOfflineImages?: boolean
}

/**
 * Carte produit 2-colonnes (maquette V3) :
 * icône catégorie (pas de photo contributeur OFF), nom gras, portion grise.
 */
export function FoodProductCard({
  hit,
  selected,
  onToggle,
}: FoodProductCardProps) {
  const name = cleanupFoodName(hit.nom)
  const portion = formatOffServingSize(hit.servingSize)
  const iconCategory = hit.foodIconCategory ?? resolveFoodIconCategory(hit.categoriesTags)

  return (
    <button
      type="button"
      data-food-card
      data-selected={selected ? 'true' : 'false'}
      data-food-icon-category={iconCategory}
      onClick={onToggle}
      aria-label={selected ? `Retirer ${name}` : `Choisir ${name}`}
      aria-pressed={selected}
      className={`relative flex w-full flex-col overflow-hidden rounded-[22px] border bg-[#1A1A1C] text-left transition-[border-color,box-shadow] ${
        selected
          ? 'border-[#FF2B2B] shadow-[0_0_0_1px_rgb(255_43_43_/_0.35)]'
          : 'border-white/[0.08]'
      }`}
    >
      <div className="relative flex h-[132px] w-full items-center justify-center bg-[#1A1A1C] px-3 pt-3">
        <FoodCategoryIcon
          category={iconCategory}
          categoriesTags={hit.categoriesTags}
          size={96}
          label={name}
        />
        {selected ? (
          <span
            data-food-card-check
            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#FF2B2B] shadow-[0_2px_8px_rgb(0_0_0_/_0.35)]"
            aria-hidden
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 px-3 pb-3.5 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.4rem] break-words text-[14px] font-bold leading-snug tracking-tight text-white">
          {name}
        </h3>
        <span
          data-portion-label
          className="min-w-0 whitespace-normal break-words text-[12px] font-medium leading-snug text-[#8E8E93]"
        >
          {portion}
        </span>
      </div>
    </button>
  )
}
