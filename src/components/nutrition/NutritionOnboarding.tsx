import { useMemo, useState } from 'react'
import { ChevronRight, Ruler, Scale, Sparkles, Target, UserRound } from 'lucide-react'
import type { ActivityLevel, BodyMorphology, CalorieProfile, Sex } from '../../types/nutrition'
import {
  GOAL_LABELS,
  computeCaloriePlan,
  inferGoalFromWeights,
} from '../../utils/calories'
import { MORPHOLOGY_LABELS } from '../../utils/morphology'
import { IconBadge } from '../ui/IconBadge'
import { ClearableNumberInput } from './ClearableNumberInput'
import { ActivityLevelPicker } from './ActivityLevelPicker'
import { MorphologyPicker } from './MorphologyPicker'

interface NutritionOnboardingProps {
  initial: CalorieProfile
  onComplete: (profile: CalorieProfile) => void
}

type Step = 'goal' | 'body' | 'morphology' | 'result'

const STEPS: Step[] = ['goal', 'body', 'morphology', 'result']

export function NutritionOnboarding({ initial, onComplete }: NutritionOnboardingProps) {
  const [step, setStep] = useState<Step>('goal')
  const [goalWeightKg, setGoalWeightKg] = useState(initial.goalWeightKg || 65)
  const [weightKg, setWeightKg] = useState(initial.weightKg || 70)
  const [heightCm, setHeightCm] = useState(initial.heightCm || 170)
  const [age, setAge] = useState(initial.age || 24)
  const [sex, setSex] = useState<Sex>(initial.sex || 'male')
  const [activity, setActivity] = useState<ActivityLevel>(initial.activity || 'moderate')
  const [morphology, setMorphology] = useState<BodyMorphology>(
    initial.morphology || 'mesomorph',
  )

  const draft: CalorieProfile = useMemo(
    () => ({
      weightKg,
      goalWeightKg,
      heightCm,
      age,
      sex,
      activity,
      morphology,
      goal: inferGoalFromWeights(weightKg, goalWeightKg),
      onboardingComplete: true,
    }),
    [weightKg, goalWeightKg, heightCm, age, sex, activity, morphology],
  )

  const plan = useMemo(() => computeCaloriePlan(draft), [draft])

  const title =
    step === 'goal'
      ? 'Quel poids vises-tu ?'
      : step === 'body'
        ? 'Où en es-tu aujourd’hui ?'
        : step === 'morphology'
          ? 'Ta morphologie'
          : 'Ton plan personnalisé'

  return (
    <section className="ios-fade-up space-y-5">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 15% 0%, rgb(52 199 89 / 0.22) 0%, transparent 55%), rgb(28 28 30 / 0.92)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <IconBadge icon={Target} variant="green" size="sm" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Setup nutrition
            </p>
            <h2 className="text-[22px] font-bold tracking-tight text-white">{title}</h2>
          </div>
        </div>

        <div className="mb-5 flex gap-1.5">
          {STEPS.map((item, index) => (
            <div
              key={item}
              className={`h-1 flex-1 rounded-full transition-colors ${
                STEPS.indexOf(step) >= index ? 'bg-[#30D158]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {step === 'goal' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              Indique ton objectif. On calcule ensuite tes calories automatiquement.
            </p>
            <label className="glass-card block rounded-2xl p-4">
              <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                <Target className="h-3.5 w-3.5 text-[#30D158]" />
                Poids objectif
              </span>
              <div className="flex items-end gap-2">
                <ClearableNumberInput
                  value={goalWeightKg}
                  onChange={(v) => {
                    if (v != null) setGoalWeightKg(v)
                  }}
                  min={35}
                  max={250}
                  step={0.5}
                  aria-label="Poids objectif"
                  className="w-full bg-transparent text-[40px] font-black tracking-tight text-white outline-none"
                />
                <span className="pb-2 text-[15px] font-medium text-[#8E8E93]">kg</span>
              </div>
            </label>
            <button
              type="button"
              onClick={() => setStep('body')}
              className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white"
            >
              Continuer
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {step === 'body' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="glass-card block rounded-2xl p-3.5">
                <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                  <Scale className="h-3.5 w-3.5 text-[#FF9F0A]" />
                  Poids actuel
                </span>
                <div className="flex items-end gap-1">
                  <ClearableNumberInput
                    value={weightKg}
                    onChange={(v) => {
                      if (v != null) setWeightKg(v)
                    }}
                    min={35}
                    max={250}
                    step={0.5}
                    aria-label="Poids actuel"
                    className="w-full bg-transparent text-[28px] font-bold text-white outline-none"
                  />
                  <span className="pb-1 text-[13px] text-[#8E8E93]">kg</span>
                </div>
              </label>
              <label className="glass-card block rounded-2xl p-3.5">
                <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                  <Ruler className="h-3.5 w-3.5 text-[#00B4FF]" />
                  Taille
                </span>
                <div className="flex items-end gap-1">
                  <ClearableNumberInput
                    value={heightCm}
                    onChange={(v) => {
                      if (v != null) setHeightCm(v)
                    }}
                    min={120}
                    max={230}
                    aria-label="Taille"
                    className="w-full bg-transparent text-[28px] font-bold text-white outline-none"
                  />
                  <span className="pb-1 text-[13px] text-[#8E8E93]">cm</span>
                </div>
              </label>
            </div>

            <label className="glass-card block rounded-2xl p-3.5">
              <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                <UserRound className="h-3.5 w-3.5 text-[#FF9F0A]" />
                Âge
              </span>
              <ClearableNumberInput
                value={age}
                onChange={(v) => {
                  if (v != null) setAge(v)
                }}
                min={14}
                max={90}
                aria-label="Âge"
                className="w-full bg-transparent text-[24px] font-bold text-white outline-none"
              />
            </label>

            <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {(
                [
                  { value: 'male' as const, label: 'Homme' },
                  { value: 'female' as const, label: 'Femme' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSex(option.value)}
                  className={`ios-press flex-1 rounded-lg py-2 text-[13px] font-semibold ${
                    sex === option.value ? 'bg-[#30D158] text-white' : 'text-[#8E8E93]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <ActivityLevelPicker value={activity} onChange={setActivity} />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('goal')}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => setStep('morphology')}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Continuer
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'morphology' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              On adapte les portions à ta morphologie — surtout si tu as du mal avec les gros
              repas.
            </p>
            <MorphologyPicker value={morphology} onChange={setMorphology} />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('body')}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => setStep('result')}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Calculer
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#30D158]/25 bg-[#30D158]/10 p-4 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                Objectif {GOAL_LABELS[plan.goal]} · {MORPHOLOGY_LABELS[morphology]}
              </p>
              <p className="mt-1 text-[42px] font-black tracking-tight text-white">
                {plan.targetCalories}
                <span className="ml-1 text-[16px] font-semibold text-[#30D158]">kcal/j</span>
              </p>
              <p className="mt-2 text-[13px] text-[#AEAEB2]">
                {weightKg} kg → {goalWeightKg} kg
                {plan.estimatedWeeks != null && <> · ~{plan.estimatedWeeks} semaines</>}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protéines', value: `${plan.proteinG} g` },
                { label: 'Glucides', value: `${plan.carbsG} g` },
                { label: 'Lipides', value: `${plan.fatG} g` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center"
                >
                  <p className="text-[10px] text-[#8E8E93]">{item.label}</p>
                  <p className="mt-1 text-[15px] font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('morphology')}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => onComplete(draft)}
                className="btn-brand ios-press flex-[1.5] rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Valider mon plan
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
