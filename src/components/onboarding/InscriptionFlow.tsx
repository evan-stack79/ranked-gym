import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { CalorieProfile, HealthAnswerStatus, Sex } from '../../types/nutrition'
import { NumberWheel } from '../common/NumberWheel'
import { normalizeCalorieProfile } from '../../services/nutritionStorage'
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  PLAUSIBLE_AGE_MAX,
  PLAUSIBLE_AGE_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  clampHeightCm,
  clampWeightKg,
  sanitizeAge,
  sanitizeHeightCm,
  sanitizeWeightKg,
  shouldShowPregnancyBreastfeedingChoices,
  shouldShowWeightScreen,
} from '../../services/nutritionSafetyRules'
import { M_INFO_1, Q7_INTRO } from '../../content/safetyCopy'

export type InscriptionStep =
  | 'welcome'
  | 'age'
  | 'sex'
  | 'health'
  | 'height'
  | 'weight'
  | 'ready'

interface InscriptionFlowProps {
  initial: CalorieProfile
  onComplete: (profile: CalorieProfile) => void
}

export interface DraftAnswers {
  age: number | null
  /** male | female | prefer_not_to_say | null (Plus tard) */
  sex: Sex | null
  healthAnswer: HealthAnswerStatus | null
  pregnancy: boolean
  breastfeeding: boolean
  eatingDisorder: boolean
  heightCm: number | null
  weightKg: number | null
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Visible steps for the progress bar — weight omitted when hidden so the bar
 * never jumps and still reaches the end.
 */
export function buildInscriptionSteps(draft: DraftAnswers): InscriptionStep[] {
  const steps: InscriptionStep[] = ['welcome', 'age', 'sex', 'health', 'height']
  if (
    shouldShowWeightScreen({
      age: draft.age,
      weightKg: draft.weightKg,
      heightCm: draft.heightCm,
      sex: draft.sex,
      healthAnswer: draft.healthAnswer,
      declarations: {
        pregnancy: draft.pregnancy,
        breastfeeding: draft.breastfeeding,
        eatingDisorder: draft.eatingDisorder,
        preferNotToAnswer: draft.healthAnswer === 'prefer_not',
      },
    })
  ) {
    steps.push('weight')
  }
  steps.push('ready')
  return steps
}

/**
 * Progress 0→1 across only the screens the person will see.
 * First screen = 0; final « C'est prêt » = 1 (100%).
 */
export function computeInscriptionProgress(
  activeStep: InscriptionStep,
  steps: InscriptionStep[],
): number {
  if (steps.length <= 1) return 1
  const idx = steps.indexOf(activeStep)
  if (idx < 0) return 0
  return idx / (steps.length - 1)
}

export function InscriptionFlow({ initial, onComplete }: InscriptionFlowProps) {
  const [draft, setDraft] = useState<DraftAnswers>(() => ({
    age: sanitizeAge(initial.age),
    sex: initial.sex ?? null,
    healthAnswer: initial.healthAnswer ?? null,
    pregnancy: Boolean(initial.declaredPregnancy),
    breastfeeding: Boolean(initial.declaredBreastfeeding),
    eatingDisorder: Boolean(initial.declaredEatingDisorder),
    heightCm: sanitizeHeightCm(initial.heightCm),
    weightKg: sanitizeWeightKg(initial.weightKg),
  }))

  const steps = useMemo(() => buildInscriptionSteps(draft), [draft])
  const [step, setStep] = useState<InscriptionStep>('welcome')

  useEffect(() => {
    if (!steps.includes(step)) {
      setStep(steps[steps.length - 1] ?? 'ready')
    }
  }, [steps, step])

  const activeStep = steps.includes(step) ? step : (steps[steps.length - 1] ?? 'ready')
  const stepIndex = Math.max(0, steps.indexOf(activeStep))
  const progress = computeInscriptionProgress(activeStep, steps)
  const reduced = prefersReducedMotion()
  const showPregBreast = shouldShowPregnancyBreastfeedingChoices(draft.sex)

  const goNextFrom = (current: InscriptionStep, answers: DraftAnswers) => {
    const list = buildInscriptionSteps(answers)
    const idx = list.indexOf(current)
    const next = list[idx + 1]
    if (next) setStep(next)
  }

  const goBack = () => {
    const idx = steps.indexOf(activeStep)
    const prev = steps[idx - 1]
    if (prev) setStep(prev)
  }

  const finish = (answers: DraftAnswers) => {
    const healthAnswer = answers.healthAnswer
    const sex = answers.sex
    const showWeight = shouldShowWeightScreen({
      age: answers.age,
      weightKg: answers.weightKg,
      heightCm: answers.heightCm,
      sex,
      healthAnswer,
      declarations: {
        pregnancy: answers.pregnancy,
        breastfeeding: answers.breastfeeding,
        eatingDisorder: answers.eatingDisorder,
        preferNotToAnswer: healthAnswer === 'prefer_not',
      },
    })
    const now = Date.now()
    const next = normalizeCalorieProfile({
      ...initial,
      age: answers.age ?? 0,
      sex,
      sexUpdatedAt: sex != null ? now : (initial.sexUpdatedAt ?? null),
      heightCm: answers.heightCm,
      weightKg: showWeight ? answers.weightKg : null,
      declaredPregnancy: healthAnswer === 'situations' ? answers.pregnancy : false,
      declaredBreastfeeding: healthAnswer === 'situations' ? answers.breastfeeding : false,
      declaredEatingDisorder: healthAnswer === 'situations' ? answers.eatingDisorder : false,
      preferNotAnswerHealth: healthAnswer === 'prefer_not',
      healthAnswer,
      healthAnswerUpdatedAt: healthAnswer != null ? now : (initial.healthAnswerUpdatedAt ?? null),
      onboardingComplete: true,
      bodyMetricsClearedAt:
        answers.heightCm == null && (!showWeight || answers.weightKg == null)
          ? (initial.bodyMetricsClearedAt ?? null)
          : null,
    })
    onComplete(next)
  }

  const healthHasChoice =
    draft.healthAnswer === 'none' ||
    draft.healthAnswer === 'prefer_not' ||
    (draft.healthAnswer === 'situations' &&
      (draft.pregnancy || draft.breastfeeding || draft.eatingDisorder))

  const canContinue =
    activeStep === 'welcome' ||
    activeStep === 'ready' ||
    (activeStep === 'age' && draft.age != null) ||
    (activeStep === 'sex' && draft.sex != null) ||
    (activeStep === 'health' && healthHasChoice) ||
    (activeStep === 'height' && draft.heightCm != null) ||
    (activeStep === 'weight' && draft.weightKg != null)

  const onContinuer = () => {
    if (activeStep === 'ready') {
      finish(draft)
      return
    }
    if (activeStep !== 'welcome' && !canContinue) return
    goNextFrom(activeStep, draft)
  }

  /** Plus tard — clears this screen's answer, saves nothing for it, advances. */
  const onPlusTard = () => {
    if (activeStep === 'ready') {
      finish(draft)
      return
    }
    const cleared: DraftAnswers = {
      ...draft,
      ...(activeStep === 'age' ? { age: null } : {}),
      ...(activeStep === 'sex' ? { sex: null } : {}),
      ...(activeStep === 'health'
        ? {
            healthAnswer: null as HealthAnswerStatus | null,
            pregnancy: false,
            breastfeeding: false,
            eatingDisorder: false,
          }
        : {}),
      ...(activeStep === 'height' ? { heightCm: null } : {}),
      ...(activeStep === 'weight' ? { weightKg: null } : {}),
    }
    setDraft(cleared)
    goNextFrom(activeStep, cleared)
  }

  const toggleSituation = (key: 'pregnancy' | 'breastfeeding' | 'eatingDisorder') => {
    setDraft((d) => {
      const flipped = !d[key]
      const next = {
        ...d,
        healthAnswer: 'situations' as const,
        pregnancy: key === 'pregnancy' ? flipped : d.pregnancy,
        breastfeeding: key === 'breastfeeding' ? flipped : d.breastfeeding,
        eatingDisorder: key === 'eatingDisorder' ? flipped : d.eatingDisorder,
      }
      if (!next.pregnancy && !next.breastfeeding && !next.eatingDisorder) {
        return { ...next, healthAnswer: null }
      }
      return next
    })
  }

  const pickExclusive = (answer: 'none' | 'prefer_not') => {
    setDraft((d) => ({
      ...d,
      healthAnswer: d.healthAnswer === answer ? null : answer,
      pregnancy: false,
      breastfeeding: false,
      eatingDisorder: false,
    }))
  }

  const titleFor = (s: InscriptionStep): string => {
    switch (s) {
      case 'welcome':
        return 'Bienvenue'
      case 'age':
        return 'Ton âge'
      case 'sex':
        return 'Sexe'
      case 'health':
        return 'Une de ces situations te concerne ?'
      case 'height':
        return 'Ta taille'
      case 'weight':
        return 'Ton poids'
      case 'ready':
        return "C'est prêt"
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="inscription-flow"
      data-inscription-step={activeStep}
    >
      <div className="mb-4" data-testid="inscription-progress">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand"
            style={{
              width: `${Math.round(progress * 100)}%`,
              transition: reduced ? undefined : 'width 220ms var(--ease-out, ease-out)',
            }}
            data-progress={String(progress)}
            data-steps={String(steps.length)}
          />
        </div>
        <p className="sr-only">
          Étape {stepIndex + 1} sur {steps.length}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="ios-press -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white"
            aria-label="Retour"
            data-testid="inscription-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <span className="h-10 w-10" aria-hidden />
        )}
        <h2 className="flex-1 text-[22px] font-bold tracking-tight text-white">
          {titleFor(activeStep)}
        </h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" key={activeStep}>
        {activeStep === 'welcome' ? (
          <div className="space-y-4" data-testid="inscription-welcome">
            <p
              className="text-[15px] leading-relaxed text-[#AEAEB2]"
              data-testid="inscription-reperes"
            >
              {M_INFO_1}
            </p>
            <p className="text-[14px] leading-relaxed text-[#8E8E93]">
              Quelques questions facultatives pour adapter ce que l&apos;app te propose. Tu peux
              répondre Plus tard à tout moment.
            </p>
          </div>
        ) : null}

        {activeStep === 'age' ? (
          <div className="space-y-3" data-testid="inscription-age">
            <NumberWheel
              min={PLAUSIBLE_AGE_MIN}
              max={PLAUSIBLE_AGE_MAX}
              step={1}
              value={draft.age}
              onChange={(v) => setDraft((d) => ({ ...d, age: v == null ? null : Math.round(v) }))}
              unit="ans"
              aria-label="Âge en années"
              validateParsed={(n) => sanitizeAge(n) != null}
            />
            <p className="text-center text-[12px] text-[#636366]">
              {draft.age == null ? 'Fais glisser ou tape pour choisir' : `${draft.age} ans`}
            </p>
          </div>
        ) : null}

        {activeStep === 'sex' ? (
          <div className="space-y-2" data-testid="inscription-sex">
            {(
              [
                { id: 'female' as const, label: 'Femme' },
                { id: 'male' as const, label: 'Homme' },
                { id: 'prefer_not_to_say' as const, label: 'Je préfère ne pas répondre' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, sex: opt.id }))}
                className={`ios-press w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold ${
                  draft.sex === opt.id
                    ? opt.id === 'prefer_not_to_say'
                      ? 'border-white/25 bg-white/10 text-white'
                      : 'border-brand bg-brand/20 text-white'
                    : 'border-white/10 bg-black/25 text-white'
                }`}
                data-testid={`inscription-sex-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {activeStep === 'health' ? (
          <div className="space-y-3" data-testid="inscription-health">
            <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{Q7_INTRO}</p>
            <div className="space-y-2">
              {showPregBreast ? (
                <>
                  <HealthChoice
                    label="Grossesse"
                    checked={draft.healthAnswer === 'situations' && draft.pregnancy}
                    onToggle={() => toggleSituation('pregnancy')}
                    testId="inscription-health-pregnancy"
                  />
                  <HealthChoice
                    label="Allaitement"
                    checked={draft.healthAnswer === 'situations' && draft.breastfeeding}
                    onToggle={() => toggleSituation('breastfeeding')}
                    testId="inscription-health-breastfeeding"
                  />
                </>
              ) : null}
              <HealthChoice
                label="Trouble du comportement alimentaire (actuel ou passé)"
                checked={draft.healthAnswer === 'situations' && draft.eatingDisorder}
                onToggle={() => toggleSituation('eatingDisorder')}
                testId="inscription-health-tca"
              />
            </div>
            <div className="h-2" aria-hidden />
            <div className="space-y-2">
              <HealthChoice
                label="Aucune de ces situations"
                checked={draft.healthAnswer === 'none'}
                onToggle={() => pickExclusive('none')}
                testId="inscription-health-none"
                exclusive
              />
              <HealthChoice
                label="Je préfère ne pas répondre"
                checked={draft.healthAnswer === 'prefer_not'}
                onToggle={() => pickExclusive('prefer_not')}
                testId="inscription-health-prefer-not"
                exclusive
              />
            </div>
          </div>
        ) : null}

        {activeStep === 'height' ? (
          <div className="space-y-3" data-testid="inscription-height">
            <NumberWheel
              min={HEIGHT_CM_MIN}
              max={HEIGHT_CM_MAX}
              step={1}
              value={draft.heightCm == null ? null : Math.round(draft.heightCm)}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  heightCm: v == null ? null : clampHeightCm(v),
                }))
              }
              unit="cm"
              aria-label="Taille en cm"
              validateParsed={(cm) => sanitizeHeightCm(cm) != null}
            />
            <p className="text-center text-[12px] text-[#636366]">
              {draft.heightCm == null
                ? 'Fais glisser ou tape pour choisir'
                : `${Math.round(draft.heightCm)} cm`}
            </p>
          </div>
        ) : null}

        {activeStep === 'weight' ? (
          <div className="space-y-3" data-testid="inscription-weight">
            <NumberWheel
              min={WEIGHT_KG_MIN}
              max={WEIGHT_KG_MAX}
              step={1}
              value={draft.weightKg == null ? null : Math.round(draft.weightKg * 10) / 10}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  weightKg: v == null ? null : clampWeightKg(v),
                }))
              }
              unit="kg"
              aria-label="Poids en kg"
              validateParsed={(kg) => sanitizeWeightKg(kg) != null}
            />
            <p className="text-center text-[12px] text-[#636366]">
              {draft.weightKg == null ? 'Fais glisser ou tape pour choisir' : `${draft.weightKg} kg`}
            </p>
          </div>
        ) : null}

        {activeStep === 'ready' ? (
          <div className="space-y-3 py-6 text-center" data-testid="inscription-ready">
            <p className="text-[18px] font-semibold leading-relaxed text-white">
              C&apos;est prêt. Tu peux changer tes réponses quand tu veux dans Profil.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-3 pb-2">
        <button
          type="button"
          onClick={onContinuer}
          disabled={activeStep !== 'welcome' && activeStep !== 'ready' && !canContinue}
          className="btn-brand ios-press min-h-12 flex-1 rounded-2xl py-3 text-[15px] font-bold text-white disabled:opacity-40"
          data-testid="inscription-continue"
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onPlusTard}
          className="ios-press min-h-12 flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-[15px] font-semibold text-[#AEAEB2]"
          data-testid="inscription-later"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}

function HealthChoice({
  label,
  checked,
  onToggle,
  testId,
  exclusive = false,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  testId: string
  exclusive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ios-press flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left ${
        checked ? 'border-white/25 bg-white/10' : 'border-white/10 bg-black/25'
      }`}
      data-testid={testId}
      data-exclusive={exclusive || undefined}
      data-choice-style={exclusive ? 'radio' : 'checkbox'}
      aria-pressed={checked}
    >
      {exclusive ? (
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            checked ? 'border-brand bg-brand' : 'border-white/30'
          }`}
          aria-hidden
          data-testid={`${testId}-radio`}
        >
          {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
        </span>
      ) : (
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${
            checked ? 'border-brand bg-brand' : 'border-white/30 bg-transparent'
          }`}
          aria-hidden
          data-testid={`${testId}-checkbox`}
        >
          {checked ? (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" aria-hidden>
              <path
                d="M2.5 6.2 5 8.7 9.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      )}
      <span className="text-[14px] font-medium text-white">{label}</span>
    </button>
  )
}
