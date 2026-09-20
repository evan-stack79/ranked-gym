interface MacroStat {
  label: string
  consumedG: number
  targetG: number
}

interface NutritionMacrosRowProps {
  protein: MacroStat
  carbs: MacroStat
  fat: MacroStat
}

function MacroColumn({ label, consumedG, targetG }: MacroStat) {
  const progress = targetG > 0 ? Math.min(Math.max(consumedG, 0) / targetG, 1) : 0
  const consumedLabel = Math.round(consumedG)
  const targetLabel = Math.round(targetG)

  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-[12px] font-medium text-[#8E8E93]">{label}</p>
      <p className="mt-1 text-[14px] font-bold tabular-nums tracking-tight text-white">
        {consumedLabel} / {targetLabel} g
      </p>
      <div
        className="mx-auto mt-2 h-[3px] w-full max-w-[88px] overflow-hidden rounded-full bg-[#2A2A2E]"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="motion-progress-fill h-full rounded-full bg-[#FF2B2B]"
          style={{ transform: `scaleX(${Math.max(0.02, progress)})` }}
        />
      </div>
    </div>
  )
}

export function NutritionMacrosRow({ protein, carbs, fat }: NutritionMacrosRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <MacroColumn {...protein} />
      <MacroColumn {...carbs} />
      <MacroColumn {...fat} />
    </div>
  )
}
