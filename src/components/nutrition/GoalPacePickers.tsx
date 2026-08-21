import type { NutritionGoal } from '../../types/nutrition'
import { GOAL_LABELS, WEEKLY_PACE_OPTIONS_KG } from '../../utils/calories'

interface GoalPickerProps {
  value: NutritionGoal
  onChange: (goal: NutritionGoal) => void
}

const GOAL_OPTIONS: Array<{ value: NutritionGoal; hint: string }> = [
  { value: 'cut', hint: 'Déficit · perdre du gras' },
  { value: 'maintain', hint: 'Calories d’entretien' },
  { value: 'bulk', hint: 'Surplus · prendre du muscle' },
]

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[#8E8E93]">Objectif</p>
      <div className="grid grid-cols-3 gap-2">
        {GOAL_OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`ios-press rounded-2xl border px-2 py-3 text-center transition-colors ${
                selected
                  ? 'border-[#30D158]/50 bg-[#30D158]/15'
                  : 'border-white/10 bg-black/25'
              }`}
            >
              <p
                className={`text-[13px] font-bold ${selected ? 'text-[#30D158]' : 'text-white'}`}
              >
                {GOAL_LABELS[option.value]}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#8E8E93]">{option.hint}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface WeeklyPacePickerProps {
  value: number
  onChange: (kgPerWeek: number) => void
  goal: NutritionGoal
}

export function WeeklyPacePicker({ value, onChange, goal }: WeeklyPacePickerProps) {
  if (goal === 'maintain') return null

  const verb = goal === 'cut' ? 'perdre' : 'prendre'

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#8E8E93]">
          Rythme · {verb} / semaine
        </p>
        <p className="text-[15px] font-bold text-white">{value.toFixed(1)} kg</p>
      </div>
      <input
        type="range"
        min={0.2}
        max={0.75}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#30D158]"
        aria-label="Rythme hebdomadaire en kg"
      />
      <div className="flex flex-wrap gap-1.5">
        {WEEKLY_PACE_OPTIONS_KG.map((pace) => {
          const selected = Math.abs(value - pace) < 0.001
          return (
            <button
              key={pace}
              type="button"
              onClick={() => onChange(pace)}
              className={`ios-press rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                selected
                  ? 'border-[#30D158]/50 bg-[#30D158]/20 text-[#30D158]'
                  : 'border-white/10 bg-black/20 text-[#AEAEB2]'
              }`}
            >
              {pace.toFixed(1)}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[#8E8E93]">
        Ce rythme fixe ton déficit / surplus calorique dans Nutri.
      </p>
    </div>
  )
}
