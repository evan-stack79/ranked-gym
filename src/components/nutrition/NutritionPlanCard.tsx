import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Flame, Ruler, Scale, Target, Pencil } from 'lucide-react'
import type { CalorieProfile, Sex } from '../../types/nutrition'
import { GOAL_LABELS, computeCaloriePlan } from '../../utils/calories'
import { normalizeCalorieProfile } from '../../services/nutritionStorage'
import { IconBadge } from '../ui/IconBadge'
import { MacroRing } from './MacroRing'
import { IosSheet } from '../ui/IosSheet'
import { ClearableNumberInput } from './ClearableNumberInput'
import { ActivityLevelPicker } from './ActivityLevelPicker'
import { MorphologyPicker } from './MorphologyPicker'
import { GoalPicker, WeeklyPacePicker } from './GoalPacePickers'
import { MORPHOLOGY_LABELS } from '../../utils/morphology'
import { getAdjustedNutritionTarget } from '../../services/nutritionActivity'

interface NutritionPlanCardProps {
  profile: CalorieProfile
  onChange: (profile: CalorieProfile) => void
}

function Field({
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
        <ClearableNumberInput
          value={value}
          onChange={(v) => {
            if (v != null) onChange(v)
          }}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          className="w-full bg-transparent text-[26px] font-bold tracking-tight text-white outline-none"
        />
        <span className="pb-1 text-[13px] font-medium text-[#8E8E93]">{suffix}</span>
      </div>
    </label>
  )
}

export function NutritionPlanCard({ profile, onChange }: NutritionPlanCardProps) {
  const [scaleOpen, setScaleOpen] = useState(false)
  const [draft, setDraft] = useState(profile)

  useEffect(() => {
    setDraft(profile)
  }, [profile])

  const plan = useMemo(() => computeCaloriePlan(profile), [profile])
  const adjusted = useMemo(() => getAdjustedNutritionTarget(profile), [profile])

  const progressToGoal = useMemo(() => {
    const start = profile.weightKg
    const goal = profile.goalWeightKg
    if (Math.abs(start - goal) < 0.05) return 1
    const total = Math.abs(start - goal)
    const remaining = Math.abs(profile.weightKg - goal)
    return Math.max(0, Math.min(1, 1 - remaining / Math.max(total, 0.1)))
  }, [profile])

  const saveScale = () => {
    const next = normalizeCalorieProfile({
      ...draft,
      onboardingComplete: true,
    })
    onChange(next)
    setScaleOpen(false)
  }

  return (
    <>
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(52 199 89 / 0.2) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 100% 100%, rgb(0 180 255 / 0.12) 0%, transparent 50%), rgb(28 28 30 / 0.9)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 12px 40px rgb(0 0 0 / 0.3)',
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconBadge icon={Flame} variant="green" size="sm" />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Plan · {GOAL_LABELS[plan.goal]} · {MORPHOLOGY_LABELS[profile.morphology]}
                {profile.goal !== 'maintain' && (
                  <> · {profile.weeklyPaceKg.toFixed(1)} kg/sem.</>
                )}
              </p>
              <h2 className="text-[20px] font-bold tracking-tight text-white">Calories du jour</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScaleOpen(true)}
            className="ios-press inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-[#AEAEB2]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Balance
          </button>
        </div>

        <div className="mb-5 flex items-center gap-5">
          <MacroRing progress={1} size={120} stroke={9} color="#34C759">
            <p className="text-[11px] font-semibold text-[#8E8E93]">Cible</p>
            <p className="text-[24px] font-black tracking-tight text-white">
              {adjusted.targetCalories}
            </p>
            <p className="text-[11px] font-medium text-[#30D158]">kcal</p>
          </MacroRing>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[13px] text-[#8E8E93]">Objectif poids</p>
              <p className="text-[22px] font-bold tracking-tight text-white">
                {profile.weightKg}
                <span className="mx-1 text-[#8E8E93]">→</span>
                {profile.goalWeightKg}
                <span className="ml-1 text-[13px] font-medium text-[#8E8E93]">kg</span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00B4FF] to-[#30D158] transition-all duration-500"
                style={{ width: `${Math.max(8, progressToGoal * 100)}%` }}
              />
            </div>
            <p className="text-[12px] text-[#8E8E93]">
              {plan.deltaKg === 0
                ? 'Tu es sur ton poids cible'
                : plan.deltaKg < 0
                  ? `${Math.abs(plan.deltaKg)} kg à perdre`
                  : `+${plan.deltaKg} kg à prendre`}
              {plan.estimatedWeeks != null && <> · ~{plan.estimatedWeeks} sem.</>}
              {adjusted.activityBonus > 0 && (
                <>
                  {' '}
                  · <span className="text-[#30D158]">+{adjusted.activityBonus} act.</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Protéines', value: `${plan.proteinG} g`, color: '#FF2B2B' },
            { label: 'Glucides', value: `${plan.carbsG} g`, color: '#FF9F0A' },
            { label: 'Lipides', value: `${plan.fatG} g`, color: '#00B4FF' },
          ].map((macro) => (
            <div key={macro.label} className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
              <p className="text-[10px] font-medium text-[#8E8E93]">{macro.label}</p>
              <p className="mt-0.5 text-[15px] font-bold text-white">{macro.value}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-4/5 rounded-full" style={{ background: macro.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
            <p className="text-[10px] text-[#8E8E93]">BMR</p>
            <p className="text-[14px] font-semibold text-[#00B4FF]">{plan.bmr}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
            <p className="text-[10px] text-[#8E8E93]">TDEE</p>
            <p className="text-[14px] font-semibold text-[#FF9F0A]">{plan.tdee}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
            <p className="text-[10px] text-[#8E8E93]">Taille</p>
            <p className="text-[14px] font-semibold text-white">{profile.heightCm} cm</p>
          </div>
        </div>
      </section>

      <IosSheet
        open={scaleOpen}
        onClose={() => setScaleOpen(false)}
        title="Mettre à jour"
        subtitle="Poids, objectif, rythme & morphologie"
        leading={<Scale className="mt-0.5 h-5 w-5 text-[#30D158]" />}
      >
        <div className="space-y-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Poids actuel"
              value={draft.weightKg}
              onChange={(v) => setDraft((p) => ({ ...p, weightKg: v }))}
              min={35}
              max={250}
              step={0.1}
              suffix="kg"
              icon={<Scale className="h-3.5 w-3.5 text-[#FF9F0A]" />}
            />
            <Field
              label="Poids cible"
              value={draft.goalWeightKg}
              onChange={(v) => setDraft((p) => ({ ...p, goalWeightKg: v }))}
              min={35}
              max={250}
              step={0.1}
              suffix="kg"
              icon={<Target className="h-3.5 w-3.5 text-[#30D158]" />}
            />
          </div>
          <Field
            label="Taille"
            value={draft.heightCm}
            onChange={(v) => setDraft((p) => ({ ...p, heightCm: v }))}
            min={120}
            max={230}
            suffix="cm"
            icon={<Ruler className="h-3.5 w-3.5 text-[#00B4FF]" />}
          />
          <Field
            label="Âge"
            value={draft.age}
            onChange={(v) => setDraft((p) => ({ ...p, age: v }))}
            min={14}
            max={90}
            suffix="ans"
            icon={<span className="text-[11px] text-[#8E8E93]">ans</span>}
          />

          <GoalPicker
            value={draft.goal}
            onChange={(goal) =>
              setDraft((p) => ({
                ...p,
                goal,
                weeklyPaceKg: goal === 'maintain' ? 0 : p.weeklyPaceKg || 0.5,
              }))
            }
          />

          <WeeklyPacePicker
            value={draft.weeklyPaceKg > 0 ? draft.weeklyPaceKg : 0.5}
            onChange={(weeklyPaceKg) => setDraft((p) => ({ ...p, weeklyPaceKg }))}
            goal={draft.goal}
          />

          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {(
              [
                { value: 'male' as Sex, label: 'Homme' },
                { value: 'female' as Sex, label: 'Femme' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, sex: option.value }))}
                className={`ios-press flex-1 rounded-lg py-2 text-[13px] font-semibold ${
                  draft.sex === option.value ? 'bg-[#30D158] text-white' : 'text-[#8E8E93]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <ActivityLevelPicker
            value={draft.activity}
            onChange={(level) => setDraft((p) => ({ ...p, activity: level }))}
          />

          <div className="pt-1">
            <p className="mb-2 text-[12px] font-semibold text-[#8E8E93]">Morphologie</p>
            <MorphologyPicker
              value={draft.morphology}
              onChange={(morphology) => setDraft((p) => ({ ...p, morphology }))}
              compact
            />
          </div>

          <button
            type="button"
            onClick={saveScale}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[16px] font-semibold text-white"
          >
            Enregistrer
          </button>
        </div>
      </IosSheet>
    </>
  )
}
