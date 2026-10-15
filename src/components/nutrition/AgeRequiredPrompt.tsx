import { useState } from 'react'
import { ClearableNumberInput } from './ClearableNumberInput'
import {
  isMinorAge,
  isPlausibleOnboardingAge,
  PLAUSIBLE_AGE_MAX,
  PLAUSIBLE_AGE_MIN,
} from '../../services/nutritionSafetyRules'

interface AgeRequiredPromptProps {
  /** Enregistre l’âge (et éventuellement déclenche le flux mineur ensuite). */
  onAgeSubmit: (age: number) => void
}

/**
 * Prompt bloquant (comme l’écran règles) quand l’âge est manquant.
 * N’efface jamais les repas existants — le parent masque seulement le journal.
 */
export function AgeRequiredPrompt({ onAgeSubmit }: AgeRequiredPromptProps) {
  const [age, setAge] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (age == null || !isPlausibleOnboardingAge(age)) {
      setError(`Indique un âge entre ${PLAUSIBLE_AGE_MIN} et ${PLAUSIBLE_AGE_MAX} ans.`)
      return
    }
    setError(null)
    onAgeSubmit(age)
  }

  return (
    <div
      className="flex flex-col gap-5 pb-2"
      data-testid="age-required-prompt"
      role="dialog"
      aria-labelledby="age-required-title"
      aria-modal="true"
    >
      <header>
        <h1 id="age-required-title" className="text-[34px] font-bold tracking-tight text-white">
          Ton âge
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#AEAEB2]">
          Pour adapter Nutrition à ton profil, indique ton âge. Tes repas déjà enregistrés sont
          conservés.
        </p>
      </header>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Âge</span>
        <ClearableNumberInput
          value={age}
          onChange={setAge}
          min={PLAUSIBLE_AGE_MIN}
          max={PLAUSIBLE_AGE_MAX}
          aria-label="Âge"
          placeholder={`${PLAUSIBLE_AGE_MIN}–${PLAUSIBLE_AGE_MAX}`}
          className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF2B2B]/40"
        />
      </label>

      {error ? (
        <p className="text-[13px] text-[#FF6961]" role="alert">
          {error}
        </p>
      ) : null}

      {age != null && isMinorAge(age) ? (
        <p className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3 text-[13px] leading-relaxed text-[#EBEBF5]">
          Moins de 18 ans : le journal repas restera masqué (tes données restent enregistrées).
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        className="btn-brand w-full rounded-xl border border-white/15 py-3.5 text-[15px] font-semibold text-white"
        data-testid="age-required-submit"
      >
        Continuer
      </button>
    </div>
  )
}
