import { LiveBottleVisual } from './LiveBottleVisual'
import {
  WATER_CONTAINER_CAPACITY_ML,
  type WaterContainerKind,
} from '../../shared/hydration'

export type CatalogContainer = Exclude<WaterContainerKind, 'gourd'>

const OPTIONS: Array<{ id: CatalogContainer; label: string }> = [
  { id: 'plastic_15', label: 'Bouteille 1,5 L' },
  { id: 'small_50', label: 'Petite bouteille 50 cl' },
  { id: 'glass_25', label: 'Verre 25 cl' },
]

/** Preview fill for thumbs (visual only). */
const THUMB_ML: Record<CatalogContainer, number> = {
  plastic_15: 620,
  small_50: 175,
  glass_25: 140,
}

export function ContainerPicker({
  selected,
  onSelect,
}: {
  selected: CatalogContainer
  onSelect: (id: CatalogContainer) => void
}) {
  return (
    <div className="space-y-2" data-hydration-container-picker>
      <p className="text-[15px] font-semibold text-white">Contenant</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.id
          const capacity = WATER_CONTAINER_CAPACITY_ML[opt.id]
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`ios-press flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center ${
                isSelected
                  ? 'border-[#FF0702]/50 bg-[#FF0702]/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
              data-hydration-container={opt.id}
              aria-pressed={isSelected}
            >
              <div className="flex h-[64px] items-end justify-center" aria-hidden>
                <LiveBottleVisual
                  kind={opt.id}
                  ml={THUMB_ML[opt.id]}
                  capacityMl={capacity}
                  size="thumb"
                />
              </div>
              <span className="block text-[11px] font-semibold leading-tight text-white">
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
