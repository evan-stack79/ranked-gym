import { MSG_PRO_BOTTLE, type HydrationMode } from '../../shared/hydration'

interface WaterModePickerProps {
  mode: HydrationMode
  proActive: boolean
  onSelect: (mode: HydrationMode) => void
  onRequestPro: () => void
}

export function WaterModePicker({
  mode,
  proActive,
  onSelect,
  onRequestPro,
}: WaterModePickerProps) {
  const options: Array<{ id: HydrationMode; label: string; detail: string; pro?: boolean }> = [
    { id: 'classic_2l', label: 'Bouteille 2 L', detail: 'Gratuit' },
    { id: 'glasses_250', label: 'Verres 250 ml', detail: 'Gratuit' },
    { id: 'my_bottle', label: 'Ma bouteille', detail: 'Pass Pro', pro: true },
  ]

  return (
    <div className="space-y-2" data-hydration-mode-picker>
      <p className="text-[15px] font-semibold text-white">Mode d’affichage</p>
      <div className="space-y-2">
        {options.map((opt) => {
          const selected = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (opt.pro && !proActive) {
                  onRequestPro()
                  return
                }
                onSelect(opt.id)
              }}
              className={`ios-press flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left ${
                selected
                  ? 'border-[#FF0702]/50 bg-[#FF0702]/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
              data-hydration-mode-option={opt.id}
            >
              <span>
                <span className="block text-[14px] font-semibold text-white">{opt.label}</span>
                <span className="block text-[12px] text-[#8E8E93]">{opt.detail}</span>
              </span>
              {opt.pro ? (
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]">
                  Pro
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="text-[12px] leading-snug text-[#8E8E93]">{MSG_PRO_BOTTLE}</p>
    </div>
  )
}
