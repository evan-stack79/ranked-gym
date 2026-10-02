import type { NutritionGoal } from '../../types/nutrition'
import { GOAL_LABELS } from '../../utils/calories'
import {
  clampWeeklyPaceKg,
  defaultWeeklyPaceKg,
  maxWeeklyPaceKgWithDeficit,
} from '../../services/nutritionSafetyRules'
import { Q3_VITESSE, SEC_NUT_05_ORIGINE } from '../../content/safetyCopy'

interface GoalPickerProps {
  value: NutritionGoal | null
  onChange: (goal: NutritionGoal) => void
  /** Si false, l'objectif « perte » (cut) n'est pas proposé. */
  allowCut?: boolean
}

const GOAL_OPTIONS: Array<{ value: NutritionGoal; hint: string }> = [
  { value: 'cut', hint: 'Déficit · perdre du gras' },
  { value: 'maintain', hint: 'Calories d’entretien' },
  { value: 'bulk', hint: 'Surplus · prendre du muscle' },
]

export function GoalPicker({ value, onChange, allowCut = true }: GoalPickerProps) {
  const options = allowCut ? GOAL_OPTIONS : GOAL_OPTIONS.filter((o) => o.value !== 'cut')
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[#8E8E93]">Objectif</p>
      <div className={`grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((option) => {
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
  weightKg: number
}

export function WeeklyPacePicker({ value, onChange, goal, weightKg }: WeeklyPacePickerProps) {
  if (goal === 'maintain') return null

  const verb = goal === 'cut' ? 'perdre' : 'prendre'
  const maxPace = maxWeeklyPaceKgWithDeficit(weightKg > 0 ? weightKg : 70)
  const minPace = 0.1
  const safeValue = clampWeeklyPaceKg(value > 0 ? value : defaultWeeklyPaceKg(weightKg || 70), weightKg || 70)
  const defaultPctLabel = ((weightKg || 70) * 0.005).toFixed(2)

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#8E8E93]">
          Rythme · {verb} / semaine
        </p>
        <p className="text-[15px] font-bold text-white">{safeValue.toFixed(2)} kg</p>
      </div>
      <input
        type="range"
        min={minPace}
        max={maxPace}
        step={0.01}
        value={Math.min(safeValue, maxPace)}
        onChange={(e) => onChange(clampWeeklyPaceKg(parseFloat(e.target.value), weightKg || 70))}
        className="w-full accent-[#30D158]"
        aria-label="Rythme hebdomadaire en kg"
      />
      <p className="text-[11px] text-[#8E8E93]">
        Défaut proposé : 0,5 % du poids (~{defaultPctLabel} kg/sem). Plafond : {maxPace.toFixed(2)}{' '}
        kg/sem.
      </p>
      <p className="text-[11px] leading-relaxed text-[#8E8E93]">{Q3_VITESSE}</p>
      <p className="text-[11px] leading-relaxed text-[#8E8E93]">{SEC_NUT_05_ORIGINE}</p>
    </div>
  )
}
