import { GlassWater } from 'lucide-react'
import {
  canSubmitHomeQuickWater,
  HOME_QUICK_WATER_ML,
} from '../../utils/homeNutritionQuickActions'

interface NutritionHydrationCardProps {
  consumedMl: number
  goalMl: number
  onAdd250: () => void
  saving?: boolean
}

function formatLiters(ml: number): string {
  return (Math.max(0, ml) / 1000).toFixed(2).replace('.', ',')
}

export function NutritionHydrationCard({
  consumedMl,
  goalMl,
  onAdd250,
  saving = false,
}: NutritionHydrationCardProps) {
  const safeGoal = Math.max(100, goalMl)
  const progress = Math.min(Math.max(0, consumedMl) / safeGoal, 1)
  const canAdd = canSubmitHomeQuickWater(saving)

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3">
      <GlassWater className="h-6 w-6 shrink-0 text-white" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white">Hydratation</p>
        <p className="mt-0.5 text-[13px] font-medium tabular-nums text-[#AEAEB2]">
          {formatLiters(consumedMl)} / {formatLiters(safeGoal)} L
        </p>
        <div
          className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#2A2A2E]"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression hydratation"
        >
          <div
            className="motion-progress-fill h-full rounded-full bg-[#FF2B2B]"
            style={{ transform: `scaleX(${Math.max(0.02, progress)})` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd250}
        disabled={!canAdd}
        aria-label={`Ajouter ${HOME_QUICK_WATER_ML} ml`}
        className="ios-press shrink-0 rounded-xl bg-[#FF2B2B] px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        +{HOME_QUICK_WATER_ML} ml
      </button>
    </div>
  )
}
