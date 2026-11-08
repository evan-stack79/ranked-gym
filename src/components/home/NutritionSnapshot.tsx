import { useEffect, useMemo, useState } from 'react'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { getCalorieProfile, getTodayJournal } from '../../services/nutritionStorage'
import { isCalorieGoalEnabled } from '../../backend/calorieGoalFeatureFlag'
import { isMinorAge } from '../../services/nutritionSafetyRules'
import { SoftBlurIn, StaticKcalNumber } from '../motion'

interface NutritionSnapshotProps {
  onOpenNutrition?: () => void
}

/**
 * Accueil — calories only (M1). L’eau est uniquement via WaterCard (hydration*).
 */
export function NutritionSnapshot({ onOpenNutrition }: NutritionSnapshotProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener('ranked-gym:profile-changed', sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('ranked-gym:profile-changed', sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const snapshot = useMemo(() => {
    void tick
    const nutrition = getNutritionTarget()
    const profile = getCalorieProfile()
    const meals = getTodayJournal().meals
    const consumedCalories = meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0)

    const targetCalories = nutrition.targetCalories
    const targetAvailable = nutrition.engineOk && targetCalories > 0
    const remainingCalories = targetAvailable
      ? Math.max(0, targetCalories - consumedCalories)
      : 0
    const progress =
      targetAvailable && targetCalories > 0
        ? Math.min(consumedCalories / targetCalories, 1)
        : 0

    const calorieGoalEnabled = isCalorieGoalEnabled()
    const minor = isMinorAge(profile.age)

    return {
      onboardingComplete: nutrition.profile.onboardingComplete,
      targetAvailable,
      showUnavailableGoal: !targetAvailable && calorieGoalEnabled && !minor,
      targetCalories,
      remainingCalories,
      consumedCalories,
      progress,
    }
  }, [tick])

  if (!snapshot.onboardingComplete) {
    return (
      <section className="glass-card rounded-2xl p-4" aria-label="Nutrition">
        <p className="text-[11px] font-medium text-[#ACB4BA]">Nutrition</p>
        <p className="mt-2 text-[14px] leading-snug text-[#ACB4BA]">
          Configure ton plan dans l&apos;onglet Nutri pour voir ton suivi.
        </p>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-4" aria-label="Nutrition">
      <div>
        <p className="text-[11px] font-medium text-[#ACB4BA]">
          <SoftBlurIn>Nutrition</SoftBlurIn>
        </p>
        {snapshot.showUnavailableGoal ? (
          <>
            <p className="mt-1 text-[17px] font-semibold text-white">Objectif indisponible</p>
            <p className="mt-1 text-[13px] text-[#ACB4BA]">Ouvre Nutri pour vérifier ton plan.</p>
          </>
        ) : snapshot.targetAvailable ? (
          <>
            <p className="mt-1 text-[17px] font-semibold text-white">
              <StaticKcalNumber value={snapshot.remainingCalories} /> kcal restantes
            </p>
            <p className="mt-1 text-[13px] text-[#ACB4BA]">
              <StaticKcalNumber value={snapshot.consumedCalories} /> /{' '}
              <StaticKcalNumber value={snapshot.targetCalories} /> kcal
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[17px] font-semibold text-white">Suivi du jour</p>
            <p className="mt-1 text-[13px] text-[#ACB4BA]">
              <StaticKcalNumber value={snapshot.consumedCalories} /> kcal consommées
            </p>
          </>
        )}

        {snapshot.targetAvailable ? (
          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={Math.round(snapshot.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression calorique"
          >
            <div
              className="motion-progress-fill h-full rounded-full bg-gradient-to-r from-[#B91C1C] to-[#FF0702]"
              style={{ transform: `scaleX(${Math.max(0, Math.min(snapshot.progress, 1))})` }}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenNutrition}
          disabled={!onOpenNutrition}
          aria-label="Ajouter un repas"
          className="btn-brand ios-press mt-4 min-h-11 w-full rounded-2xl border border-white/15 px-3 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000] disabled:opacity-50"
        >
          Ajouter un repas
        </button>
      </div>
    </section>
  )
}
