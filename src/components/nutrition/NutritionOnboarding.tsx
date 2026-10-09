import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Sparkles, Target, UserRound } from 'lucide-react'
import type { ActivityLevel, BodyMorphology, CalorieProfile, NutritionGoal, Sex } from '../../types/nutrition'
import { GOAL_LABELS } from '../../utils/calories'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { MORPHOLOGY_LABELS } from '../../utils/morphology'
import { normalizeCalorieProfile } from '../../services/nutritionStorage'
import { IconBadge } from '../ui/IconBadge'
import { ClearableNumberInput } from './ClearableNumberInput'
import { HeightWeightPicker } from '../common/HeightWeightPicker'
import { ActivityLevelPicker } from './ActivityLevelPicker'
import { MorphologyPicker } from './MorphologyPicker'
import { GoalPicker, WeeklyPacePicker } from './GoalPacePickers'
import { isCalorieGoalEnabled } from '../../backend/calorieGoalFeatureFlag'
import {
  decideLossEligibility,
  defaultWeeklyPaceKg,
  estimationDisclaimerForAge,
  isMinorAge,
  messageForLossRefusal,
  PLAUSIBLE_AGE_MAX,
  PLAUSIBLE_AGE_MIN,
  readHealthDeclarations,
  shouldShowHeightWeightPicker,
} from '../../services/nutritionSafetyRules'
import {
  HealthSituationsForm,
  healthSituationsFromProfile,
} from '../settings/HealthSituationsForm'
import { NeedToTalkScreen } from '../settings/NeedToTalkScreen'
import {
  M_CAL_1,
  M_CAL_2,
  M_INFO_1,
  M_MIN_1,
  M_TCA_1,
  Q6A_MINEURS,
  Q6B_GROSSESSE_ALLAITEMENT,
  Q8_SCREEN_TITLE,
} from '../../content/safetyCopy'

interface NutritionOnboardingProps {
  initial: CalorieProfile
  onComplete: (profile: CalorieProfile) => void
}

type Step =
  | 'lite'
  | 'goal'
  | 'goalWeight'
  | 'pace'
  | 'measurements'
  | 'activity'
  | 'morphology'
  | 'result'
  | 'exit'

function seedNumber(value: number): number | null {
  return value > 0 ? value : null
}

function stepTitle(step: Step): string {
  switch (step) {
    case 'lite':
      return 'Ton profil'
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
    case 'exit':
      return 'Accès à l’app'
  }
}

export function NutritionOnboarding({ initial, onComplete }: NutritionOnboardingProps) {
  const calorieGoalEnabled = isCalorieGoalEnabled()
  const [step, setStep] = useState<Step>(calorieGoalEnabled ? 'goal' : 'lite')
  const [error, setError] = useState<string | null>(null)
  const [showNeedToTalk, setShowNeedToTalk] = useState(false)

  // SEC-TCA-04 / SEC-NUT-01 : rien de présélectionné pour un nouvel onboarding.
  const [goal, setGoal] = useState<NutritionGoal | null>(
    initial.onboardingComplete ? initial.goal : null,
  )
  const [weeklyPaceKg, setWeeklyPaceKg] = useState(
    initial.weeklyPaceKg > 0
      ? initial.weeklyPaceKg
      : initial.weightKg != null && initial.weightKg > 0
        ? defaultWeeklyPaceKg(initial.weightKg)
        : 0,
  )
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(
    seedNumber(initial.goalWeightKg ?? 0),
  )
  const [weightKg, setWeightKg] = useState<number | null>(seedNumber(initial.weightKg ?? 0))
  const [heightCm, setHeightCm] = useState<number | null>(seedNumber(initial.heightCm ?? 0))
  const [age, setAge] = useState<number | null>(seedNumber(initial.age))
  const [sex, setSex] = useState<Sex | null>(initial.sex)
  const [activity, setActivity] = useState<ActivityLevel>(initial.activity || 'moderate')
  const [morphology, setMorphology] = useState<BodyMorphology>(
    initial.morphology || 'mesomorph',
  )
  const [health, setHealth] = useState(() => healthSituationsFromProfile(initial))

  const declarations = useMemo(() => readHealthDeclarations({ ...health }), [health])
  const isMinor = age != null && isMinorAge(age)
  const isRestrictedHealth =
    declarations.pregnancy || declarations.breastfeeding || declarations.eatingDisorder

  const steps = useMemo<Step[]>(() => {
    if (!calorieGoalEnabled) {
      return ['lite', 'exit']
    }
    // BUG-08 ON : mensurations (âge) avant « poids objectif » / « rythme »
    const flow: Step[] = ['goal', 'measurements']
    const ageKnownAdult = age != null && !isMinorAge(age)
    if (ageKnownAdult && !isRestrictedHealth) {
      flow.push('goalWeight')
      if (goal != null && goal !== 'maintain') flow.push('pace')
      flow.push('activity', 'morphology', 'result')
    }
    flow.push('exit')
    return flow
  }, [calorieGoalEnabled, goal, age, isRestrictedHealth])

  const stepIndex = Math.max(0, steps.indexOf(step))

  useEffect(() => {
    if (step === 'exit') return
    if (!steps.includes(step)) {
      setStep(steps[Math.max(0, stepIndex - 1)] ?? (calorieGoalEnabled ? 'goal' : 'lite'))
    }
  }, [steps, step, stepIndex, calorieGoalEnabled])

  const measurementsComplete =
    weightKg != null &&
    heightCm != null &&
    age != null &&
    sex != null &&
    weightKg > 0 &&
    heightCm > 0 &&
    age > 0

  const lossGate = useMemo(
    () =>
      decideLossEligibility(
        {
          age: age ?? null,
          weightKg: weightKg ?? null,
          heightCm: heightCm ?? null,
          sex,
          goalWeightKg: goalWeightKg ?? null,
          declarations,
        },
        { calorieGoalEnabled },
      ),
    [age, weightKg, heightCm, sex, goalWeightKg, declarations, calorieGoalEnabled],
  )

  /** Cut : jamais si TCA/grossesse ; sinon seulement après mensurations éligibles. */
  const allowCut =
    calorieGoalEnabled &&
    !isRestrictedHealth &&
    (measurementsComplete ? lossGate.eligible : true)

  const showBodyFields = shouldShowHeightWeightPicker({
    age,
    weightKg,
    heightCm,
    sex,
    declarations,
  })
  const [bodyNoted, setBodyNoted] = useState(false)

  const draft: CalorieProfile | null = useMemo(() => {
    if (!calorieGoalEnabled) return null
    if (
      goal == null ||
      sex == null ||
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
      ...health,
    })
  }, [
    calorieGoalEnabled,
    weightKg,
    goalWeightKg,
    heightCm,
    age,
    sex,
    activity,
    morphology,
    goal,
    weeklyPaceKg,
    health,
  ])

  const nutrition = useMemo(
    () => (draft ? getNutritionTarget(draft, { calorieGoalEnabled }) : null),
    [draft, calorieGoalEnabled],
  )

  useEffect(() => {
    if (step === 'result' && draft && nutrition && !nutrition.engineOk) {
      setStep('exit')
    }
  }, [step, draft, nutrition])

  const estimatedWeeks = useMemo(() => {
    if (!draft || draft.goal === 'maintain' || draft.weeklyPaceKg <= 0) return null
    if (draft.goalWeightKg == null || draft.weightKg == null) return null
    const deltaKg = Math.round((draft.goalWeightKg - draft.weightKg) * 10) / 10
    if (deltaKg === 0) return null
    return Math.max(1, Math.ceil(Math.abs(deltaKg) / draft.weeklyPaceKg))
  }, [draft])

  const buildLiteProfile = (): CalorieProfile | null => {
    if (age == null || sex == null || age <= 0) return null
    const minor = isMinorAge(age)
    // Plus tard / mineur / restricted : poids/taille peuvent rester vides (null, jamais 0).
    const w = minor || isRestrictedHealth ? null : weightKg
    const h = minor || isRestrictedHealth ? null : heightCm
    return normalizeCalorieProfile({
      weightKg: w,
      goalWeightKg: w,
      heightCm: h,
      age,
      sex,
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'maintain',
      weeklyPaceKg: 0,
      onboardingComplete: true,
      ...health,
    })
  }

  const buildRestrictedProfile = (): CalorieProfile | null => {
    if (age == null || sex == null || age <= 0) return null
    // Sortie anticipée (TCA/grossesse/mineur) : poids/taille optionnels → null
    return normalizeCalorieProfile({
      weightKg: null,
      goalWeightKg: null,
      heightCm: null,
      age,
      sex,
      activity: activity || 'moderate',
      morphology: morphology || 'mesomorph',
      goal: 'maintain',
      weeklyPaceKg: 0,
      onboardingComplete: true,
      ...health,
    })
  }

  const applyHealthChange = (next: typeof health) => {
    setHealth(next)
    const d = readHealthDeclarations({ ...next })
    // BUG-31 : TCA / grossesse / allaitement dès l'étape 1 → interrompre l'assistant
    if (
      calorieGoalEnabled &&
      (d.pregnancy || d.breastfeeding || d.eatingDisorder) &&
      step !== 'exit'
    ) {
      setGoal('maintain')
      setWeeklyPaceKg(0)
      setError(null)
      setStep('exit')
    }
  }

  const goBack = () => {
    setError(null)
    const prev = steps[stepIndex - 1]
    if (prev) setStep(prev)
  }

  const goGoalWeight = () => {
    if (isRestrictedHealth) {
      setError(null)
      setStep('exit')
      return
    }
    if (goal == null) {
      setError('Choisis un objectif pour continuer.')
      return
    }
    // BUG-04 / BUG-08 ON : mensurations (âge) avant poids objectif / rythme.
    setError(null)
    setStep('measurements')
  }

  const goAfterGoalWeight = () => {
    if (goalWeightKg == null || goalWeightKg < 35) {
      setError('Indique ton poids objectif (ex. 61.7).')
      return
    }
    setError(null)
    setStep(goal === 'maintain' ? 'activity' : 'pace')
  }

  const goAfterPace = () => {
    if (goal !== 'maintain' && weeklyPaceKg < 0.1) {
      setError('Choisis un rythme hebdomadaire.')
      return
    }
    setError(null)
    setStep('activity')
  }

  const goActivity = (bodyOverride?: { weightKg: number; heightCm: number }) => {
    if (age == null || sex == null) {
      setError('Remplis âge et sexe.')
      return
    }
    if (age < PLAUSIBLE_AGE_MIN || age > PLAUSIBLE_AGE_MAX) {
      setError(`Indique un âge entre ${PLAUSIBLE_AGE_MIN} et ${PLAUSIBLE_AGE_MAX} ans.`)
      return
    }
    // BUG-02 / BUG-08 : mineur → âge enregistré, pas de poids/taille, sortie app.
    if (isMinorAge(age)) {
      setWeightKg(null)
      setHeightCm(null)
      setError(null)
      setStep('exit')
      return
    }
    const w = bodyOverride?.weightKg ?? weightKg
    const h = bodyOverride?.heightCm ?? heightCm
    if (w == null || h == null || w <= 0 || h <= 0) {
      setError('Choisis taille et poids, ou appuie sur Plus tard.')
      return
    }
    // BUG-04 : éligibilité perte une fois les mensurations connues.
    if (goal === 'cut' && !lossGate.eligible) {
      const msg = messageForLossRefusal(lossGate.reason)
      setGoal('maintain')
      setWeeklyPaceKg(0)
      setError(msg)
      return
    }
    setError(null)
    setStep('goalWeight')
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
    // BUG-03 : grossesse / allaitement / TCA → écran de sortie, pas d'écran vide.
    if (isRestrictedHealth || (nutrition && !nutrition.engineOk && !nutrition.showCalorieGoal)) {
      setError(null)
      setStep('exit')
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

  const submitLiteOrExit = () => {
    // BUG-36 : situation à risque (OFF) → poids/taille non requis (comme ON)
    const profile =
      calorieGoalEnabled || isRestrictedHealth
        ? buildRestrictedProfile()
        : buildLiteProfile()
    if (!profile) {
      setError(
        (age != null && isMinorAge(age)) || isRestrictedHealth
          ? 'Remplis âge et sexe.'
          : 'Remplis âge, sexe, poids actuel et taille.',
      )
      return
    }
    onComplete(profile)
  }

  const continueLite = (bodyOverride?: { weightKg: number; heightCm: number }) => {
    if (age == null || sex == null) {
      setError('Remplis âge et sexe.')
      return
    }
    if (age < PLAUSIBLE_AGE_MIN || age > PLAUSIBLE_AGE_MAX) {
      setError(`Indique un âge entre ${PLAUSIBLE_AGE_MIN} et ${PLAUSIBLE_AGE_MAX} ans.`)
      return
    }
    setError(null)
    if (isMinorAge(age)) {
      setWeightKg(null)
      setHeightCm(null)
      setStep('exit')
      return
    }
    if (isRestrictedHealth) {
      setStep('exit')
      return
    }
    const w = bodyOverride?.weightKg ?? weightKg
    const h = bodyOverride?.heightCm ?? heightCm
    if (w == null || h == null) {
      setError('Choisis taille et poids, ou appuie sur Plus tard.')
      return
    }
    setWeightKg(w)
    setHeightCm(h)
    setBodyNoted(true)
    window.setTimeout(() => {
      setBodyNoted(false)
      const profile = normalizeCalorieProfile({
        weightKg: w,
        goalWeightKg: w,
        heightCm: h,
        age,
        sex,
        activity: 'moderate',
        morphology: 'mesomorph',
        goal: 'maintain',
        weeklyPaceKg: 0,
        onboardingComplete: true,
        ...health,
      })
      onComplete(profile)
    }, 700)
  }

  const skipBodyMetrics = () => {
    // Plus tard : ne sauvegarde rien — laisse null, n'écrit pas encore le profil.
    setWeightKg(null)
    setHeightCm(null)
    setError(null)
    if (!calorieGoalEnabled) {
      if (age != null && sex != null) {
        const profile = normalizeCalorieProfile({
          weightKg: null,
          goalWeightKg: null,
          heightCm: null,
          age,
          sex,
          activity: 'moderate',
          morphology: 'mesomorph',
          goal: 'maintain',
          weeklyPaceKg: 0,
          onboardingComplete: true,
          ...health,
        })
        onComplete(profile)
      }
      return
    }
    setStep('exit')
  }

  if (showNeedToTalk) {
    return <NeedToTalkScreen onBack={() => setShowNeedToTalk(false)} />
  }

  const progressSteps = steps.filter((s) => s !== 'exit' || step === 'exit')

  return (
    <section className="ios-fade-up space-y-5" data-testid="nutrition-onboarding">
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
              {calorieGoalEnabled ? 'Setup nutrition' : 'Inscription'}
            </p>
            <h2 className="text-[22px] font-bold tracking-tight text-white">{stepTitle(step)}</h2>
          </div>
        </div>

        {step !== 'exit' && (
          <div className="mb-5 flex gap-1.5">
            {progressSteps
              .filter((s) => s !== 'exit')
              .map((item, index) => (
                <div
                  key={item}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    stepIndex >= index ? 'bg-[#30D158]' : 'bg-white/10'
                  }`}
                />
              ))}
          </div>
        )}

        {error && (
          <p
            className="mb-3 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF453A]"
            data-testid="onboarding-error"
          >
            {error}
          </p>
        )}

        {step === 'lite' && (
          <div className="space-y-4" data-testid="onboarding-lite">
            <p className="text-[15px] text-[#AEAEB2]">{M_INFO_1}</p>
            <HealthSituationsForm
              value={health}
              onChange={applyHealthChange}
              showTcaMessage
              onOpenNeedToTalk={() => setShowNeedToTalk(true)}
              sex={sex}
            />
            <MeasurementsFields
              weightKg={weightKg}
              setWeightKg={setWeightKg}
              heightCm={heightCm}
              setHeightCm={setHeightCm}
              age={age}
              setAge={setAge}
              sex={sex}
              setSex={setSex}
              showBodyFields={showBodyFields}
              bodyNoted={bodyNoted}
              onSkipBody={skipBodyMetrics}
              onSaveBody={(next) => continueLite(next)}
            />
            {!showBodyFields ? (
              <button
                type="button"
                onClick={() => continueLite()}
                className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white"
              >
                Continuer
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">{M_CAL_1}</p>
            <p className="text-[13px] text-[#8E8E93]">{M_INFO_1}</p>

            <HealthSituationsForm
              value={health}
              onChange={applyHealthChange}
              showTcaMessage
              onOpenNeedToTalk={() => setShowNeedToTalk(true)}
              sex={sex}
            />

            {!isRestrictedHealth ? (
              <GoalPicker
                value={goal}
                allowCut={allowCut}
                onChange={(next) => {
                  setGoal(next)
                  if (next === 'maintain') setWeeklyPaceKg(0)
                  else if (weeklyPaceKg <= 0) {
                    setWeeklyPaceKg(defaultWeeklyPaceKg(weightKg ?? 70))
                  }
                }}
              />
            ) : null}

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
              <span className="font-semibold text-white">
                {goal ? GOAL_LABELS[goal].toLowerCase() : ''}
              </span>{' '}
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

        {step === 'pace' && goal != null && goal !== 'maintain' && (
          <div className="space-y-4">
            <p className="text-[15px] text-[#AEAEB2]">
              À quelle vitesse veux-tu progresser chaque semaine ?
            </p>

            <WeeklyPacePicker
              value={
                weeklyPaceKg > 0 ? weeklyPaceKg : defaultWeeklyPaceKg(weightKg ?? 70)
              }
              onChange={setWeeklyPaceKg}
              goal={goal}
              weightKg={weightKg ?? 70}
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
                onClick={goAfterPace}
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
              {showBodyFields
                ? 'Poids, taille, âge et sexe — base de ton métabolisme.'
                : 'Indique d’abord ton âge et ton sexe.'}
            </p>
            <MeasurementsFields
              weightKg={weightKg}
              setWeightKg={setWeightKg}
              heightCm={heightCm}
              setHeightCm={setHeightCm}
              age={age}
              setAge={setAge}
              sex={sex}
              setSex={setSex}
              showBodyFields={showBodyFields}
              bodyNoted={bodyNoted}
              onSkipBody={skipBodyMetrics}
              onSaveBody={(next) => {
                setWeightKg(next.weightKg)
                setHeightCm(next.heightCm)
                setBodyNoted(true)
                window.setTimeout(() => {
                  setBodyNoted(false)
                  goActivity(next)
                }, 700)
              }}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={goBack}
                className="ios-press flex-1 rounded-2xl border border-white/10 bg-ios-inset py-3.5 text-[15px] font-medium text-[#8E8E93]"
              >
                Retour
              </button>
              {!showBodyFields ? (
                <button
                  type="button"
                  onClick={() => goActivity()}
                  className="btn-brand ios-press flex flex-[1.4] items-center justify-center gap-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
                >
                  Continuer
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
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
          <div className="space-y-4" data-testid="onboarding-result">
            <div className="rounded-2xl border border-[#30D158]/25 bg-[#30D158]/10 p-4 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                Estimation · {GOAL_LABELS[draft.goal]} · {MORPHOLOGY_LABELS[morphology]}
              </p>
              <p className="mt-1 text-[42px] font-black tracking-tight text-white">
                {nutrition.targetCalories}
                <span className="ml-1 text-[16px] font-semibold text-[#30D158]">kcal/j</span>
              </p>
              <p className="mt-2 text-[13px] text-[#AEAEB2]">
                {draft.weightKg} kg → {draft.goalWeightKg} kg
                {draft.goal !== 'maintain' && (
                  <> · {draft.weeklyPaceKg.toFixed(2)} kg/sem.</>
                )}
                {estimatedWeeks != null && <> · ~{estimatedWeeks} sem.</>}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-[#AEAEB2]">{M_CAL_2}</p>
              {(nutrition.safetyNotices.length > 0
                ? nutrition.safetyNotices
                : [estimationDisclaimerForAge(draft.age), M_INFO_1]
              ).map((notice) => (
                <p
                  key={notice}
                  className="mt-2 text-[12px] leading-relaxed text-[#8E8E93]"
                  data-testid="safety-notice"
                >
                  {notice}
                </p>
              ))}
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

        {step === 'exit' && (
          <div className="space-y-4" data-testid="onboarding-exit">
            {isMinor ? (
              <>
                <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{Q6A_MINEURS}</p>
                <p className="text-[15px] leading-relaxed text-[#AEAEB2]">{M_MIN_1}</p>
              </>
            ) : null}
            {(declarations.pregnancy || declarations.breastfeeding) && !isMinor ? (
              <p className="text-[15px] leading-relaxed text-[#EBEBF5]">
                {Q6B_GROSSESSE_ALLAITEMENT}
              </p>
            ) : null}
            {declarations.eatingDisorder && !isMinor ? (
              <div className="space-y-2">
                <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{M_TCA_1}</p>
                <button
                  type="button"
                  onClick={() => setShowNeedToTalk(true)}
                  className="ios-press text-[14px] font-semibold text-[#64D2FF] underline"
                  data-testid="exit-need-to-talk"
                >
                  {Q8_SCREEN_TITLE}
                </button>
              </div>
            ) : null}
            {!isMinor && !isRestrictedHealth ? (
              <p className="text-[15px] leading-relaxed text-[#AEAEB2]">{M_INFO_1}</p>
            ) : null}
            {(age == null || sex == null) && (
              <MeasurementsFields
                weightKg={weightKg}
                setWeightKg={setWeightKg}
                heightCm={heightCm}
                setHeightCm={setHeightCm}
                age={age}
                setAge={setAge}
                sex={sex}
                setSex={setSex}
                showBodyFields={false}
              />
            )}
            <button
              type="button"
              onClick={submitLiteOrExit}
              className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white"
              data-testid="exit-continue"
            >
              Continuer vers l&apos;app
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function MeasurementsFields({
  weightKg,
  setWeightKg,
  heightCm,
  setHeightCm,
  age,
  setAge,
  sex,
  setSex,
  showBodyFields,
  onSkipBody,
  bodyNoted,
  onSaveBody,
}: {
  weightKg: number | null
  setWeightKg: (v: number | null) => void
  heightCm: number | null
  setHeightCm: (v: number | null) => void
  age: number | null
  setAge: (v: number | null) => void
  sex: Sex | null
  setSex: (v: Sex) => void
  showBodyFields: boolean
  onSkipBody?: () => void
  bodyNoted?: boolean
  onSaveBody?: (next: { weightKg: number; heightCm: number }) => void
}) {
  return (
    <>
      <label className="glass-card block rounded-2xl p-3.5">
        <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
          <UserRound className="h-3.5 w-3.5 text-[#FF9F0A]" />
          Âge
        </span>
        <ClearableNumberInput
          value={age}
          onChange={setAge}
          min={PLAUSIBLE_AGE_MIN}
          max={PLAUSIBLE_AGE_MAX}
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

      {showBodyFields ? (
        <div data-testid="onboarding-body-fields">
          <HeightWeightPicker
            value={{ weightKg, heightCm }}
            onChange={(next) => {
              setWeightKg(next.weightKg)
              setHeightCm(next.heightCm)
            }}
            onSave={onSaveBody}
            onSkip={onSkipBody}
            confirmMessage={bodyNoted ? 'C’est noté.' : null}
          />
        </div>
      ) : null}
    </>
  )
}
