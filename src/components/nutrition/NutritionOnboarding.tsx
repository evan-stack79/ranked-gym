import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Ruler, Scale, Sparkles, Target, UserRound } from 'lucide-react'
import type { ActivityLevel, BodyMorphology, CalorieProfile, NutritionGoal, Sex } from '../../types/nutrition'
import { GOAL_LABELS } from '../../utils/calories'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { MORPHOLOGY_LABELS } from '../../utils/morphology'
import { normalizeCalorieProfile } from '../../services/nutritionStorage'
import { IconBadge } from '../ui/IconBadge'
import { ClearableNumberInput } from './ClearableNumberInput'
import { ActivityLevelPicker } from './ActivityLevelPicker'
import { MorphologyPicker } from './MorphologyPicker'
import { GoalPicker, WeeklyPacePicker } from './GoalPacePickers'

interface NutritionOnboardingProps {
  initial: CalorieProfile
  onComplete: (profile: CalorieProfile) => void
}

type Step = 'goal' | 'goalWeight' | 'pace' | 'measurements' | 'activity' | 'morphology' | 'result'

function seedNumber(value: number): number | null {
  return value > 0 ? value : null
}

function stepTitle(step: Step): string {
  switch (step) {
    case 'goal':
      return 'Ton objectif'
    case 'goalWeight':
      return 'Ton poids objectif'
    case 'pace':
      return 'Ton rythme'
    case 'measurements':
      return 'Tes mensurations'
    case 'activity':
      return 'Ton niveau d’activité'
    case 'morphology':
      return 'Ta morphologie'
    case 'result':
      return 'Ton plan personnalisé'
  }
}

export function NutritionOnboarding({ initial, onComplete }: NutritionOnboardingProps) {
  const [step, setStep] = useState<Step>('goal')
  const [error, setError] = useState<string | null>(null)

  const [goal, setGoal] = useState<NutritionGoal>(
    initial.onboardingComplete ? initial.goal : 'cut',
  )
  const [weeklyPaceKg, setWeeklyPaceKg] = useState(
    initial.weeklyPaceKg > 0 ? initial.weeklyPaceKg : 0.5,
  )
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(
    seedNumber(initial.goalWeightKg),
  )
  const [weightKg, setWeightKg] = useState<number | null>(seedNumber(initial.weightKg))
  const [heightCm, setHeightCm] = useState<number | null>(seedNumber(initial.heightCm))
  const [age, setAge] = useState<number | null>(seedNumber(initial.age))
  const [sex, setSex] = useState<Sex>(initial.sex || 'male')
  const [activity, setActivity] = useState<ActivityLevel>(initial.activity || 'moderate')
  const [morphology, setMorphology] = useState<BodyMorphology>(
    initial.morphology || 'mesomorph',
  )

  const steps = useMemo<Step[]>(() => {
    const flow: Step[] = ['goal', 'goalWeight']
    if (goal !== 'maintain') flow.push('pace')
    flow.push('measurements', 'activity', 'morphology', 'result')
    return flow
  }, [goal])

  const stepIndex = Math.max(0, steps.indexOf(step))

  useEffect(() => {
    if (!steps.includes(step)) {
      setStep(steps[Math.max(0, stepIndex - 1)] ?? 'goal')
    }
  }, [steps, step, stepIndex])

  const draft: CalorieProfile | null = useMemo(() => {
    if (
      weightKg == null ||
      goalWeightKg == null ||
      heightCm == null ||
      age == null ||
      weightKg <= 0 ||
      goalWeightKg <= 0 ||
      heightCm <= 0 ||
      age <= 0
    ) {
      return null
    }
    return normalizeCalorieProfile({
      weightKg,
      goalWeightKg,
      heightCm,
      age,
      sex,
      activity,
      morphology,
      goal,
      weeklyPaceKg: goal === 'maintain' ? 0 : weeklyPaceKg,
      onboardingComplete: true,
    })
  }, [
    weightKg,
    goalWeightKg,
    heightCm,
    age,
    sex,
    activity,
    morphology,
    goal,
    weeklyPaceKg,
  ])

  const nutrition = useMemo(() => (draft ? getNutritionTarget(draft) : null), [draft])

  const estimatedWeeks = useMemo(() => {
    if (!draft || draft.goal === 'maintain' || draft.weeklyPaceKg <= 0) return null
    const deltaKg = Math.round((draft.goalWeightKg - draft.weightKg) * 10) / 10
    if (deltaKg === 0) return null
    return Math.max(1, Math.ceil(Math.abs(deltaKg) / draft.weeklyPaceKg))
  }, [draft])

  const goBack = () => {
    setError(null)
    const prev = steps[stepIndex - 1]
    if (prev) setStep(prev)
  }

  const goGoalWeight = () => {
    setError(null)
    setStep('goalWeight')
  }

  const goAfterGoalWeight = () => {
    if (goalWeightKg == null || goalWeightKg < 35) {
      setError('Indique ton poids objectif (ex. 61.7).')
      return
    }
    setError(null)
    setStep(goal === 'maintain' ? 'measurements' : 'pace')
  }

  const goMeasurements = () => {
    if (goal !== 'maintain' && weeklyPaceKg < 0.1) {
      setError('Choisis un rythme hebdomadaire.')
      return
    }
    setError(null)
    setStep('measurements')
  }

  const goActivity = () => {
    if (weightKg == null || heightCm == null || age == null) {
      setError('Remplis poids actuel, taille et âge.')
      return
    }
    setError(null)
    setStep('activity')
  }

  const goMorphology = () => {
    setError(null)
    setStep('morphology')
  }

  const goResult = () => {
    if (!draft) {
      setError('Complète tous les champs avant de calculer.')
      return
    }
    setError(null)
    setStep('result')
  }

  const submit = () => {
    if (!draft) {
      setError('Données incomplètes — impossible d’enregistrer.')
      return
    }
    onComplete(draft)
  }

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
            <h2 className="text-[22px] font-bold tracking-tight text-white">{stepTitle(step)}</h2>
          </div>
        </div>

        <div className="mb-5 flex gap-1.5">
          {steps.map((item, index) => (
            <div
              key={item}
              className={`h-1 flex-1 rounded-full transition-colors ${
                stepIndex >= index ? 'bg-[#30D158]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF453A]">
            {error}
          </p>
        )}

        {step === 'goal' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              On adapte les calculs à ton métabolisme pour des résultats optimaux.
            </p>

            <GoalPicker
              value={goal}
              onChange={(next) => {
                setGoal(next)
                if (next === 'maintain') setWeeklyPaceKg(0)
                else if (weeklyPaceKg <= 0) setWeeklyPaceKg(0.5)
              }}
            />

            <button
              type="button"
              onClick={goGoalWeight}
              className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white"
            >
              Continuer
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {step === 'goalWeight' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              Quel poids vises-tu avec ton objectif{' '}
              <span className="font-semibold text-white">{GOAL_LABELS[goal].toLowerCase()}</span>{' '}
              ?
            </p>

            <label className="glass-card block rounded-2xl p-4">
              <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                <Target className="h-3.5 w-3.5 text-[#30D158]" />
                Poids objectif
              </span>
              <div className="flex items-end gap-2">
                <ClearableNumberInput
                  value={goalWeightKg}
                  onChange={setGoalWeightKg}
                  min={35}
                  max={250}
                  step={0.1}
                  required={false}
                  placeholder="61.7"
                  aria-label="Poids objectif"
                  className="w-full bg-transparent text-[40px] font-black tracking-tight text-white outline-none"
                />
                <span className="pb-2 text-[15px] font-medium text-[#8E8E93]">kg</span>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goAfterGoalWeight}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Continuer
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'pace' && goal !== 'maintain' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              À quelle vitesse veux-tu progresser chaque semaine ?
            </p>

            <WeeklyPacePicker
              value={weeklyPaceKg > 0 ? weeklyPaceKg : 0.5}
              onChange={setWeeklyPaceKg}
              goal={goal}
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goMeasurements}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Continuer
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'measurements' && (
          <div className="space-y-3">
            <p className="text-[15px] text-[#AEAEB2]">
              Poids, taille, âge et sexe — base de ton métabolisme.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="glass-card block rounded-2xl p-3.5">
                <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                  <Scale className="h-3.5 w-3.5 text-[#FF9F0A]" />
                  Poids actuel
                </span>
                <div className="flex items-end gap-1">
                  <ClearableNumberInput
                    value={weightKg}
                    onChange={setWeightKg}
                    min={35}
                    max={250}
                    step={0.1}
                    required={false}
                    placeholder="70.5"
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
                    onChange={setHeightCm}
                    min={120}
                    max={230}
                    required={false}
                    placeholder="175"
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
                onChange={setAge}
                min={14}
                max={90}
                required={false}
                placeholder="24"
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

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goActivity}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Continuer
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'activity' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              Ton niveau d’activité hors séance influence ton métabolisme de base.
            </p>

            <ActivityLevelPicker value={activity} onChange={setActivity} />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goMorphology}
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
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={goResult}
                className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
              >
                Calculer
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'result' && draft && nutrition?.engineOk && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#30D158]/25 bg-[#30D158]/10 p-4 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                Objectif {GOAL_LABELS[draft.goal]} · {MORPHOLOGY_LABELS[morphology]}
              </p>
              <p className="mt-1 text-[42px] font-black tracking-tight text-white">
                {nutrition.targetCalories}
                <span className="ml-1 text-[16px] font-semibold text-[#30D158]">kcal/j</span>
              </p>
              <p className="mt-2 text-[13px] text-[#AEAEB2]">
                {draft.weightKg} kg → {draft.goalWeightKg} kg
                {draft.goal !== 'maintain' && (
                  <> · {draft.weeklyPaceKg.toFixed(1)} kg/sem.</>
                )}
                {estimatedWeeks != null && <> · ~{estimatedWeeks} sem.</>}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protéines', value: `${nutrition.proteinG} g` },
                { label: 'Glucides', value: `${nutrition.carbsG} g` },
                { label: 'Lipides', value: `${nutrition.fatG} g` },
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
                onClick={submit}
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
