import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Flame, Ruler, Scale, Sparkles, Target, UserRound } from 'lucide-react'
import type { ActivityLevel, CalorieProfile, NutritionGoal, Sex } from '../../types/nutrition'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  computeCaloriePlan,
} from '../../utils/calories'
import { getCalorieProfile, saveCalorieProfile } from '../../services/nutritionStorage'
import { IconBadge } from '../ui/IconBadge'
import { MacroRing } from './MacroRing'

interface CalorieCalculatorProps {
  onTargetChange?: (targetCalories: number) => void
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold transition-all ${
              active
                ? 'bg-gradient-to-b from-[#34C759] to-[#248A3D] text-white shadow-[0_4px_14px_rgb(52_199_89_/_0.35)]'
                : 'text-[#8E8E93] active:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  icon,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix: string
  icon: ReactNode
}) {
  return (
    <label className="glass-card block rounded-2xl p-3.5">
      <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
        {icon}
        {label}
      </span>
      <div className="flex items-end gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (!Number.isNaN(next)) onChange(Math.min(max, Math.max(min, next)))
          }}
          className="w-full bg-transparent text-[28px] font-bold tracking-tight text-white outline-none"
        />
        <span className="pb-1 text-[13px] font-medium text-[#8E8E93]">{suffix}</span>
      </div>
    </label>
  )
}

export function CalorieCalculator({ onTargetChange }: CalorieCalculatorProps) {
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setProfile(getCalorieProfile())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveCalorieProfile(profile)
  }, [profile, hydrated])

  const plan = useMemo(() => computeCaloriePlan(profile), [profile])

  useEffect(() => {
    onTargetChange?.(plan.targetCalories)
  }, [plan.targetCalories, onTargetChange])

  const update = <K extends keyof CalorieProfile>(key: K, value: CalorieProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
      style={{
        background:
          'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(52 199 89 / 0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 100% 100%, rgb(0 180 255 / 0.16) 0%, transparent 50%), rgb(28 28 30 / 0.9)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 12px 40px rgb(0 0 0 / 0.35)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, #34C75966 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <IconBadge icon={Flame} variant="green" size="sm" />
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Calculateur
            </p>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-white">Calories du jour</h2>
          <p className="mt-1 text-[13px] text-[#AEAEB2]">
            Basé sur ton poids, ta taille et ton rythme.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#34C759]/30 bg-[#34C759]/15 px-2.5 py-1 text-[10px] font-bold text-[#30D158]">
          <Sparkles className="h-3 w-3" />
          Mifflin
        </span>
      </div>

      <div className="relative mb-5 flex justify-center">
        <MacroRing progress={1} size={132} stroke={10} color="#34C759">
          <p className="text-[11px] font-semibold text-[#8E8E93]">Cible</p>
          <p className="text-[26px] font-black tracking-tight text-white">
            {plan.targetCalories}
          </p>
          <p className="text-[11px] font-medium text-[#30D158]">kcal</p>
        </MacroRing>
      </div>

      <div className="relative mb-4 grid grid-cols-3 gap-2">
        {[
          { label: 'BMR', value: plan.bmr, color: 'text-[#00B4FF]' },
          { label: 'TDEE', value: plan.tdee, color: 'text-[#FF9F0A]' },
          { label: 'Cible', value: plan.targetCalories, color: 'text-[#30D158]' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/25 px-2 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8E8E93]">
              {stat.label}
            </p>
            <p className={`mt-1 text-[16px] font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Protéines', value: `${plan.proteinG} g`, bar: '#FF2B2B', pct: 0.9 },
          { label: 'Glucides', value: `${plan.carbsG} g`, bar: '#FF9F0A', pct: 0.75 },
          { label: 'Lipides', value: `${plan.fatG} g`, bar: '#00B4FF', pct: 0.6 },
        ].map((macro) => (
          <div key={macro.label} className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
            <p className="text-[10px] font-medium text-[#8E8E93]">{macro.label}</p>
            <p className="mt-0.5 text-[15px] font-bold text-white">{macro.value}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${macro.pct * 100}%`, background: macro.bar }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="relative space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Poids"
            value={profile.weightKg}
            onChange={(v) => update('weightKg', v)}
            min={35}
            max={250}
            step={0.5}
            suffix="kg"
            icon={<Scale className="h-3.5 w-3.5 text-[#30D158]" />}
          />
          <NumberField
            label="Taille"
            value={profile.heightCm}
            onChange={(v) => update('heightCm', v)}
            min={120}
            max={230}
            suffix="cm"
            icon={<Ruler className="h-3.5 w-3.5 text-[#00B4FF]" />}
          />
        </div>

        <NumberField
          label="Âge"
          value={profile.age}
          onChange={(v) => update('age', v)}
          min={14}
          max={90}
          suffix="ans"
          icon={<UserRound className="h-3.5 w-3.5 text-[#FF9F0A]" />}
        />

        <div>
          <p className="mb-2 px-1 text-[12px] font-semibold text-[#8E8E93]">Sexe</p>
          <Segmented<Sex>
            value={profile.sex}
            onChange={(v) => update('sex', v)}
            options={[
              { value: 'male', label: 'Homme' },
              { value: 'female', label: 'Femme' },
            ]}
          />
        </div>

        <div>
          <p className="mb-2 px-1 text-[12px] font-semibold text-[#8E8E93]">Activité</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => {
              const active = profile.activity === level
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => update('activity', level)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                    active
                      ? 'border-[#00B4FF]/50 bg-[#00B4FF]/20 text-[#64D2FF]'
                      : 'border-white/10 bg-black/20 text-[#8E8E93]'
                  }`}
                >
                  {ACTIVITY_LABELS[level]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-[#8E8E93]">
            <Target className="h-3.5 w-3.5" />
            Objectif
          </p>
          <Segmented<NutritionGoal>
            value={profile.goal}
            onChange={(v) => update('goal', v)}
            options={(Object.keys(GOAL_LABELS) as NutritionGoal[]).map((goal) => ({
              value: goal,
              label: GOAL_LABELS[goal],
            }))}
          />
        </div>
      </div>
    </section>
  )
}
