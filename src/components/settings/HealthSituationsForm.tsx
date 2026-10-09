import { Q7_INTRO, M_TCA_1 } from '../../content/safetyCopy'
import type { CalorieProfile, HealthAnswerStatus } from '../../types/nutrition'
import {
  readHealthAnswer,
  shouldShowPregnancyBreastfeedingChoices,
} from '../../services/nutritionSafetyRules'

export interface HealthSituationsValue {
  declaredPregnancy: boolean
  declaredBreastfeeding: boolean
  declaredEatingDisorder: boolean
  preferNotAnswerHealth: boolean
  healthAnswer: HealthAnswerStatus | null
}

interface HealthSituationsFormProps {
  value: HealthSituationsValue
  onChange: (next: HealthSituationsValue) => void
  onOpenNeedToTalk?: () => void
  showTcaMessage?: boolean
  /** Current sex — hides Grossesse/Allaitement only when Homme. */
  sex?: CalorieProfile['sex']
}

export function healthSituationsFromProfile(profile: CalorieProfile): HealthSituationsValue {
  const answer = readHealthAnswer(profile)
  return {
    declaredPregnancy: Boolean(profile.declaredPregnancy),
    declaredBreastfeeding: Boolean(profile.declaredBreastfeeding),
    declaredEatingDisorder: Boolean(profile.declaredEatingDisorder),
    preferNotAnswerHealth: answer === 'prefer_not',
    healthAnswer: answer,
  }
}

export function HealthSituationsForm({
  value,
  onChange,
  onOpenNeedToTalk,
  showTcaMessage = true,
  sex = null,
}: HealthSituationsFormProps) {
  const showPregBreast = shouldShowPregnancyBreastfeedingChoices(sex)
  const answer = value.healthAnswer

  const emit = (partial: Partial<HealthSituationsValue>) => {
    const next = { ...value, ...partial }
    onChange({
      ...next,
      preferNotAnswerHealth: next.healthAnswer === 'prefer_not',
      healthAnswer: next.healthAnswer,
    })
  }

  const toggleSituation = (key: 'declaredPregnancy' | 'declaredBreastfeeding' | 'declaredEatingDisorder') => {
    const flipped = !value[key]
    const pregnancy = key === 'declaredPregnancy' ? flipped : value.declaredPregnancy
    const breastfeeding = key === 'declaredBreastfeeding' ? flipped : value.declaredBreastfeeding
    const eatingDisorder = key === 'declaredEatingDisorder' ? flipped : value.declaredEatingDisorder
    const any = pregnancy || breastfeeding || eatingDisorder
    emit({
      declaredPregnancy: pregnancy,
      declaredBreastfeeding: breastfeeding,
      declaredEatingDisorder: eatingDisorder,
      healthAnswer: any ? 'situations' : null,
      preferNotAnswerHealth: false,
    })
  }

  const pickExclusive = (next: 'none' | 'prefer_not') => {
    const cleared = answer === next ? null : next
    emit({
      healthAnswer: cleared,
      declaredPregnancy: false,
      declaredBreastfeeding: false,
      declaredEatingDisorder: false,
      preferNotAnswerHealth: cleared === 'prefer_not',
    })
  }

  return (
    <section className="space-y-3" data-testid="health-situations-form">
      <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{Q7_INTRO}</p>
      <div className="space-y-2">
        {showPregBreast ? (
          <>
            <HealthRow
              label="Grossesse"
              checked={answer === 'situations' && value.declaredPregnancy}
              onToggle={() => toggleSituation('declaredPregnancy')}
              testId="health-pregnancy"
            />
            <HealthRow
              label="Allaitement"
              checked={answer === 'situations' && value.declaredBreastfeeding}
              onToggle={() => toggleSituation('declaredBreastfeeding')}
              testId="health-breastfeeding"
            />
          </>
        ) : null}
        <HealthRow
          label="Trouble du comportement alimentaire (actuel ou passé)"
          checked={answer === 'situations' && value.declaredEatingDisorder}
          onToggle={() => toggleSituation('declaredEatingDisorder')}
          testId="health-tca"
        />
      </div>
      <div className="h-2" aria-hidden />
      <div className="space-y-2">
        <HealthRow
          label="Aucune de ces situations"
          checked={answer === 'none'}
          onToggle={() => pickExclusive('none')}
          testId="health-none"
        />
        <HealthRow
          label="Je préfère ne pas répondre"
          checked={answer === 'prefer_not'}
          onToggle={() => pickExclusive('prefer_not')}
          testId="health-prefer-not"
        />
      </div>

      {showTcaMessage && answer === 'situations' && value.declaredEatingDisorder ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-[#FF9F0A]/10 p-3.5">
          <p className="text-[13px] leading-relaxed text-[#EBEBF5]">{M_TCA_1}</p>
          {onOpenNeedToTalk ? (
            <button
              type="button"
              onClick={onOpenNeedToTalk}
              className="ios-press text-[13px] font-semibold text-[#64D2FF] underline"
            >
              Besoin d&apos;en parler ?
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function HealthRow({
  label,
  checked,
  onToggle,
  testId,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  testId: string
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3"
      data-testid={testId}
    >
      <input type="checkbox" className="mt-1" checked={checked} onChange={onToggle} />
      <span className="text-[14px] font-medium text-white">{label}</span>
    </label>
  )
}
