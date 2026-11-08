import { PlasticBottle15, GourdExample } from './FlatBottleSvg'

/**
 * Zone centrale : bouteille / gourde détourée EN GRAND + repère latéral
 * « glisse pour régler » + estimation ml. Style plat (pas le glossy SmartWaterGauge).
 */
export function BottleDragPanel({
  variant,
  fillRatio,
  estimateMl,
  showProChip = false,
}: {
  variant: 'plastic_15' | 'gourd'
  fillRatio: number
  estimateMl: number
  showProChip?: boolean
}) {
  const handleBottomPct = Math.min(92, Math.max(8, fillRatio * 100))

  return (
    <div className="relative flex flex-col items-center" data-mockup-drag-panel={variant}>
      {variant === 'gourd' || showProChip ? (
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[14px] font-semibold text-white">Ma bouteille</p>
          {showProChip ? (
            <span
              className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]"
              data-mockup-pro-chip
            >
              Pro
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative mx-auto flex w-full max-w-[280px] items-center justify-center">
        {variant === 'plastic_15' ? (
          <PlasticBottle15 fillRatio={fillRatio} large />
        ) : (
          <GourdExample fillRatio={fillRatio} />
        )}

        {/* Poignée / repère latéral — plat, pas de glow gadget */}
        <div
          className="absolute left-[calc(50%+38px)] flex items-center gap-2"
          style={{ bottom: `${handleBottomPct}%`, transform: 'translateY(50%)' }}
          data-mockup-drag-handle
        >
          <span className="h-5 w-5 shrink-0 rounded-full border border-[#5AC8FA]/70 bg-[#1C1C1E]" />
          <span className="w-[5.75rem] text-[11px] font-medium leading-snug text-[#ACB4BA]">
            glisse pour régler
          </span>
        </div>
      </div>

      <p
        className="mt-2 text-center text-[17px] font-semibold tabular-nums tracking-tight text-white"
        data-mockup-estimate
      >
        ≈ {estimateMl}&nbsp;ml bus
      </p>
    </div>
  )
}
