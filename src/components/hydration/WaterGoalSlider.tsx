import {
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  GOAL_STEP_ML,
  MSG_GOAL_RANGE,
  MSG_MEDICAL_LIMIT,
  MSG_PREGNANCY,
  formatLitersFr,
} from '../../shared/hydration'

interface WaterGoalSliderProps {
  valueMl: number
  onChange: (goalMl: number) => void
  disabled?: boolean
}

export function WaterGoalSlider({ valueMl, onChange, disabled }: WaterGoalSliderProps) {
  const safe = Math.min(GOAL_MAX_ML, Math.max(GOAL_MIN_ML, Math.round(valueMl || GOAL_DEFAULT_ML)))

  return (
    <div data-hydration-goal-slider className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-white">Objectif du jour</p>
        <p className="text-[15px] font-semibold tabular-nums text-white">{formatLitersFr(safe)}</p>
      </div>
      <input
        type="range"
        min={GOAL_MIN_ML}
        max={GOAL_MAX_ML}
        step={GOAL_STEP_ML}
        value={safe}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF0702]"
        aria-label="Objectif d’eau quotidienne"
        aria-valuemin={GOAL_MIN_ML}
        aria-valuemax={GOAL_MAX_ML}
        aria-valuenow={safe}
      />
      <p className="text-[12px] text-[#8E8E93]">{MSG_GOAL_RANGE}</p>
      <p className="text-[12px] leading-snug text-[#8E8E93]">{MSG_PREGNANCY}</p>
      <p className="text-[12px] leading-snug text-[#8E8E93]">{MSG_MEDICAL_LIMIT}</p>
    </div>
  )
}
