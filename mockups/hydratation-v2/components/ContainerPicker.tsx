import { PhotoThumb, type PhotoKind } from './PhotoContainer'

const OPTIONS: Array<{
  id: Exclude<PhotoKind, 'gourd'>
  label: string
  fill: number
}> = [
  { id: 'plastic_15', label: 'Bouteille 1,5 L', fill: 620 / 1500 },
  { id: 'small_50', label: 'Petite bouteille 50 cl', fill: 0.35 },
  { id: 'glass_25', label: 'Verre 25 cl', fill: 0.55 },
]

export function ContainerPicker({
  selected,
  onSelect,
}: {
  selected: Exclude<PhotoKind, 'gourd'>
  onSelect: (id: Exclude<PhotoKind, 'gourd'>) => void
}) {
  return (
    <div className="space-y-2" data-mockup-container-picker>
      <p className="text-[15px] font-semibold text-white">Contenant</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.id
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
              data-mockup-container={opt.id}
              aria-pressed={isSelected}
            >
              <PhotoThumb kind={opt.id} fillRatio={opt.fill} />
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
