import { useState } from 'react'
import { Q7_INTRO, M_INFO_1, M_TCA_1 } from '../../content/safetyCopy'
import type { CalorieProfile } from '../../types/nutrition'
import {
  clearTcaReactivationInfoPending,
  consumeTcaReactivationInfoPending,
  markTcaReactivationInfoPending,
  peekTcaReactivationInfoPending,
} from '../../services/nutritionStorage'

export interface HealthSituationsValue {
  declaredPregnancy: boolean
  declaredBreastfeeding: boolean
  declaredEatingDisorder: boolean
  preferNotAnswerHealth: boolean
}

interface HealthSituationsFormProps {
  value: HealthSituationsValue
  onChange: (next: HealthSituationsValue) => void
  onOpenNeedToTalk?: () => void
  showTcaMessage?: boolean
}

export function healthSituationsFromProfile(profile: CalorieProfile): HealthSituationsValue {
  return {
    declaredPregnancy: Boolean(profile.declaredPregnancy),
    declaredBreastfeeding: Boolean(profile.declaredBreastfeeding),
    declaredEatingDisorder: Boolean(profile.declaredEatingDisorder),
    preferNotAnswerHealth: Boolean(profile.preferNotAnswerHealth),
  }
}

export function HealthSituationsForm({
  value,
  onChange,
  onOpenNeedToTalk,
  showTcaMessage = true,
}: HealthSituationsFormProps) {
  // BUG-22 : rappel M_INFO_1 une seule fois à la réactivation (décochage TCA).
  const [showReactivationInfo, setShowReactivationInfo] = useState(() => {
    if (value.declaredEatingDisorder) return false
    if (value.preferNotAnswerHealth) return false
    if (!peekTcaReactivationInfoPending()) return false
    consumeTcaReactivationInfoPending()
    return true
  })

  const setFlag = (key: keyof HealthSituationsValue, checked: boolean) => {
    if (key === 'preferNotAnswerHealth' && checked) {
      setShowReactivationInfo(false)
      onChange({
        declaredPregnancy: false,
        declaredBreastfeeding: false,
        declaredEatingDisorder: false,
        preferNotAnswerHealth: true,
      })
      return
    }

    if (key === 'declaredEatingDisorder') {
      if (checked) {
        // Nouvelle déclaration TCA : prochain décochage pourra réafficher le rappel.
        clearTcaReactivationInfoPending()
        setShowReactivationInfo(false)
      } else if (value.declaredEatingDisorder) {
        // Réactivation : afficher une fois. Si « ne pas répondre » montre déjà M_INFO_1, ne pas marquer.
        if (!value.preferNotAnswerHealth) {
          markTcaReactivationInfoPending()
          consumeTcaReactivationInfoPending()
          setShowReactivationInfo(true)
        }
      }
    }

    onChange({
      ...value,
      [key]: checked,
      preferNotAnswerHealth: key === 'preferNotAnswerHealth' ? checked : false,
    })
  }

  // BUG-23 : ne jamais afficher M_INFO_1 en double (réactivation + « ne pas répondre »).
  const showPreferNotAnswerInfo = value.preferNotAnswerHealth
  const showMInfoOnce =
    showPreferNotAnswerInfo || (showReactivationInfo && !value.declaredEatingDisorder)

  return (
    <section className="space-y-3" data-testid="health-situations-form">
      <p className="text-[13px] leading-relaxed text-[#AEAEB2]">{Q7_INTRO}</p>
      <div className="space-y-2">
        {(
          [
            { key: 'declaredPregnancy' as const, label: 'Grossesse' },
            { key: 'declaredBreastfeeding' as const, label: 'Allaitement' },
            {
              key: 'declaredEatingDisorder' as const,
              label: 'Trouble du comportement alimentaire (actuel ou passé)',
            },
            { key: 'preferNotAnswerHealth' as const, label: 'Je préfère ne pas répondre' },
          ] as const
        ).map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={value[item.key]}
              onChange={(e) => setFlag(item.key, e.target.checked)}
            />
            <span className="text-[14px] font-medium text-white">{item.label}</span>
          </label>
        ))}
      </div>

      {showMInfoOnce ? (
        <p
          className="text-[12px] leading-relaxed text-[#8E8E93]"
          data-testid="m-info-1-notice"
        >
          {M_INFO_1}
        </p>
      ) : null}

      {showTcaMessage && value.declaredEatingDisorder ? (
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
