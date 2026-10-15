import { useState } from 'react'
import {
  Q7_INTRO,
  M_TCA_1,
  DIABETES_CLEAR_CONFIRM,
  PREGNANCY_CLEAR_CONFIRM,
  BREASTFEEDING_CLEAR_CONFIRM,
  SAFETY_CLEAR_CONFIRM_YES,
  SAFETY_CLEAR_CONFIRM_CANCEL,
  SAFETY_CLEAR_SIGN_IN,
  TCA_LOCKED_MESSAGE,
  AUCUNE_LOCKED_HINT,
} from '../../content/safetyCopy'
import type { CalorieProfile, HealthAnswerStatus } from '../../types/nutrition'
import {
  readHealthAnswer,
  shouldShowPregnancyBreastfeedingChoices,
} from '../../services/nutritionSafetyRules'
import { ContactUsBlock } from '../common/ContactUsBlock'

export interface HealthSituationsValue {
  declaredPregnancy: boolean
  declaredBreastfeeding: boolean
  declaredEatingDisorder: boolean
  declaredDiabetes: boolean
  preferNotAnswerHealth: boolean
  healthAnswer: HealthAnswerStatus | null
}

/** Flags déjà true côté serveur (sync) — verrouillent TCA / Aucune / retraits. */
export interface ServerHealthLocks {
  declaredPregnancy?: boolean
  declaredBreastfeeding?: boolean
  declaredEatingDisorder?: boolean
  declaredDiabetes?: boolean
}

export type ClearableSafetyField =
  | 'declaredDiabetes'
  | 'declaredPregnancy'
  | 'declaredBreastfeeding'

interface HealthSituationsFormProps {
  value: HealthSituationsValue
  onChange: (next: HealthSituationsValue) => void
  onOpenNeedToTalk?: () => void
  showTcaMessage?: boolean
  /** Current sex — hides Grossesse/Allaitement only when Homme. */
  sex?: CalorieProfile['sex']
  /** Situations déjà true sur le serveur. */
  serverLocks?: ServerHealthLocks
  /** Compte connecté — requis pour retirer diabète / grossesse / allaitement. */
  isAuthenticated?: boolean
  /**
   * Retrait délibéré (hors sync). Parent appelle clearSafetyFlag après Oui.
   * Doit renvoyer true si le serveur a bien clear.
   */
  onClearSafetyField?: (field: ClearableSafetyField) => boolean | Promise<boolean>
  /** Toast / message (ex. Connecte-toi…). */
  onMessage?: (message: string) => void
}

export function healthSituationsFromProfile(profile: CalorieProfile): HealthSituationsValue {
  const answer = readHealthAnswer(profile)
  return {
    declaredPregnancy: Boolean(profile.declaredPregnancy),
    declaredBreastfeeding: Boolean(profile.declaredBreastfeeding),
    declaredEatingDisorder: Boolean(profile.declaredEatingDisorder),
    declaredDiabetes: Boolean(profile.declaredDiabetes),
    preferNotAnswerHealth: answer === 'prefer_not',
    healthAnswer: answer,
  }
}

export function serverLocksFromProfile(profile: CalorieProfile): ServerHealthLocks {
  return {
    declaredPregnancy: Boolean(profile.declaredPregnancy),
    declaredBreastfeeding: Boolean(profile.declaredBreastfeeding),
    declaredEatingDisorder: Boolean(profile.declaredEatingDisorder),
    declaredDiabetes: Boolean(profile.declaredDiabetes),
  }
}

const CLEAR_CONFIRM: Record<ClearableSafetyField, string> = {
  declaredDiabetes: DIABETES_CLEAR_CONFIRM,
  declaredPregnancy: PREGNANCY_CLEAR_CONFIRM,
  declaredBreastfeeding: BREASTFEEDING_CLEAR_CONFIRM,
}

export function HealthSituationsForm({
  value,
  onChange,
  onOpenNeedToTalk,
  showTcaMessage = true,
  sex = null,
  serverLocks,
  isAuthenticated = false,
  onClearSafetyField,
  onMessage,
}: HealthSituationsFormProps) {
  const showPregBreast = shouldShowPregnancyBreastfeedingChoices(sex)
  const answer = value.healthAnswer
  const locks = serverLocks ?? {}
  const tcaLocked = Boolean(locks.declaredEatingDisorder)
  const noneLocked =
    Boolean(locks.declaredEatingDisorder) ||
    Boolean(locks.declaredPregnancy) ||
    Boolean(locks.declaredBreastfeeding) ||
    Boolean(locks.declaredDiabetes)

  const [pendingClear, setPendingClear] = useState<ClearableSafetyField | null>(null)

  const emit = (partial: Partial<HealthSituationsValue>) => {
    const next = { ...value, ...partial }
    onChange({
      ...next,
      preferNotAnswerHealth: next.healthAnswer === 'prefer_not',
      healthAnswer: next.healthAnswer,
    })
  }

  const requestClear = (field: ClearableSafetyField) => {
    const serverTrue = Boolean(locks[field])
    if (!isAuthenticated) {
      if (serverTrue) {
        onMessage?.(SAFETY_CLEAR_SIGN_IN)
        return
      }
      emit({ [field]: false } as Partial<HealthSituationsValue>)
      return
    }
    setPendingClear(field)
  }

  const confirmClearOui = async () => {
    const field = pendingClear
    if (!field) return
    setPendingClear(null)
    const serverTrue = Boolean(locks[field])
    if (serverTrue) {
      if (!onClearSafetyField) return
      const ok = await onClearSafetyField(field)
      if (!ok) return
    }
    emit({ [field]: false } as Partial<HealthSituationsValue>)
  }

  const confirmClearAnnuler = () => {
    setPendingClear(null)
  }

  const toggleSituation = (
    key: 'declaredPregnancy' | 'declaredBreastfeeding' | 'declaredEatingDisorder',
  ) => {
    if (key === 'declaredEatingDisorder' && tcaLocked) return

    const currentlyOn =
      key === 'declaredEatingDisorder'
        ? tcaLocked || (answer === 'situations' && value.declaredEatingDisorder)
        : Boolean(locks[key]) || (answer === 'situations' && value[key])

    if (currentlyOn && (key === 'declaredPregnancy' || key === 'declaredBreastfeeding')) {
      requestClear(key)
      return
    }

    const flipped = !value[key]
    const pregnancy = key === 'declaredPregnancy' ? flipped : value.declaredPregnancy
    const breastfeeding = key === 'declaredBreastfeeding' ? flipped : value.declaredBreastfeeding
    const eatingDisorder =
      key === 'declaredEatingDisorder' ? flipped : value.declaredEatingDisorder
    const nextEating = tcaLocked ? true : eatingDisorder
    const any =
      Boolean(pregnancy || locks.declaredPregnancy) ||
      Boolean(breastfeeding || locks.declaredBreastfeeding) ||
      nextEating
    emit({
      declaredPregnancy: Boolean(pregnancy || locks.declaredPregnancy),
      declaredBreastfeeding: Boolean(breastfeeding || locks.declaredBreastfeeding),
      declaredEatingDisorder: nextEating,
      healthAnswer: any ? 'situations' : value.declaredDiabetes ? value.healthAnswer : null,
      preferNotAnswerHealth: false,
    })
  }

  const toggleDiabetes = () => {
    if (value.declaredDiabetes || locks.declaredDiabetes) {
      requestClear('declaredDiabetes')
      return
    }
    emit({ declaredDiabetes: true })
  }

  const pickExclusive = (next: 'none' | 'prefer_not') => {
    // B16-01 — Aucune et « Je préfère ne pas répondre » ne peuvent pas
    // contourner un flag déjà true serveur.
    if (noneLocked) return
    const cleared = answer === next ? null : next
    emit({
      healthAnswer: cleared,
      declaredPregnancy: Boolean(locks.declaredPregnancy),
      declaredBreastfeeding: Boolean(locks.declaredBreastfeeding),
      declaredEatingDisorder: tcaLocked ? true : false,
      declaredDiabetes: Boolean(value.declaredDiabetes || locks.declaredDiabetes),
      preferNotAnswerHealth: cleared === 'prefer_not',
    })
  }

  const tcaChecked = tcaLocked || (answer === 'situations' && value.declaredEatingDisorder)
  const diabetesChecked = Boolean(value.declaredDiabetes || locks.declaredDiabetes)
  const pregnancyChecked =
    Boolean(locks.declaredPregnancy) || (answer === 'situations' && value.declaredPregnancy)
  const breastfeedingChecked =
    Boolean(locks.declaredBreastfeeding) ||
    (answer === 'situations' && value.declaredBreastfeeding)

  return (
    <section className="space-y-3" data-testid="health-situations-form">
      <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{Q7_INTRO}</p>
      <div className="space-y-2">
        {showPregBreast ? (
          <>
            <HealthRow
              label="Grossesse"
              checked={pregnancyChecked}
              onToggle={() => toggleSituation('declaredPregnancy')}
              testId="health-pregnancy"
            />
            <HealthRow
              label="Allaitement"
              checked={breastfeedingChecked}
              onToggle={() => toggleSituation('declaredBreastfeeding')}
              testId="health-breastfeeding"
            />
          </>
        ) : null}
        <HealthRow
          label="Trouble du comportement alimentaire (actuel ou passé)"
          checked={tcaChecked}
          onToggle={() => toggleSituation('declaredEatingDisorder')}
          testId="health-tca"
          disabled={tcaLocked}
        />
        {tcaLocked ? (
          <ContactUsBlock message={TCA_LOCKED_MESSAGE} testIdPrefix="health-tca-contact" />
        ) : null}
        <HealthRow
          label="Diabète"
          checked={diabetesChecked}
          onToggle={toggleDiabetes}
          testId="health-diabetes"
        />
      </div>
      <div className="h-2" aria-hidden />
      <div className="space-y-2">
        <HealthRow
          label="Aucune de ces situations"
          checked={answer === 'none'}
          onToggle={() => pickExclusive('none')}
          testId="health-none"
          disabled={noneLocked}
          hint={noneLocked ? AUCUNE_LOCKED_HINT : undefined}
        />
        <HealthRow
          label="Je préfère ne pas répondre"
          checked={answer === 'prefer_not'}
          onToggle={() => pickExclusive('prefer_not')}
          testId="health-prefer-not"
          disabled={noneLocked}
          hint={noneLocked ? AUCUNE_LOCKED_HINT : undefined}
        />
      </div>

      {pendingClear ? (
        <div
          className="space-y-3 rounded-2xl border border-white/15 bg-black/40 p-3.5"
          data-testid="health-clear-confirm"
          role="dialog"
          aria-modal="true"
        >
          <p className="text-[13px] leading-relaxed text-[#EBEBF5]" data-testid="health-clear-confirm-text">
            {CLEAR_CONFIRM[pendingClear]}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmClearOui()}
              className="btn-brand ios-press flex-1 rounded-xl py-2.5 text-[14px] font-bold text-white"
              data-testid="health-clear-confirm-yes"
            >
              {SAFETY_CLEAR_CONFIRM_YES}
            </button>
            <button
              type="button"
              onClick={confirmClearAnnuler}
              className="ios-press flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-[14px] font-semibold text-[#AEAEB2]"
              data-testid="health-clear-confirm-cancel"
            >
              {SAFETY_CLEAR_CONFIRM_CANCEL}
            </button>
          </div>
        </div>
      ) : null}

      {showTcaMessage && tcaChecked ? (
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
  disabled = false,
  hint,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  testId: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label
        className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3 ${
          disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
        }`}
        data-testid={testId}
        data-disabled={disabled ? 'true' : 'false'}
      >
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="text-[14px] font-medium text-white">{label}</span>
      </label>
      {hint ? (
        <p className="px-1 text-[12px] leading-snug text-[#8E8E93]" data-testid={`${testId}-lock-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
