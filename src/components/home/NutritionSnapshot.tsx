import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { getCalorieProfile, getTodayJournal, getTodayWaterMl } from '../../services/nutritionStorage'
import { formatWaterMl, getDailyWaterGoalMl, isTrainingDayToday } from '../../utils/waterGoal'
import {
  canSubmitHomeQuickWater,
  HOME_QUICK_WATER_ML,
  shouldShowHomeQuickWaterButton,
  tryAddHomeQuickWater,
} from '../../utils/homeNutritionQuickActions'

interface NutritionSnapshotProps {
  onOpenNutrition?: () => void
}

export function NutritionSnapshot({ onOpenNutrition }: NutritionSnapshotProps) {
  const [tick, setTick] = useState(0)
  const [waterSaving, setWaterSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null,
  )
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener('ranked-gym:profile-changed', sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('ranked-gym:water-changed', sync)
    window.addEventListener('ranked-gym:training-changed', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('ranked-gym:profile-changed', sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('ranked-gym:water-changed', sync)
      window.removeEventListener('ranked-gym:training-changed', sync)
      window.removeEventListener('focus', sync)
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant })
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2600)
  }, [])

  const snapshot = useMemo(() => {
    const nutrition = getNutritionTarget()
    const profile = getCalorieProfile()
    const meals = getTodayJournal().meals
    const waterMl = getTodayWaterMl()
    const isTrainingDay = isTrainingDayToday()
    const waterGoalMl = getDailyWaterGoalMl(profile.weightKg, isTrainingDay)
    const consumedCalories = meals.reduce((sum, meal) => sum + meal.calories, 0)

    const targetCalories = nutrition.targetCalories
    const targetAvailable = nutrition.engineOk && targetCalories > 0
    const remainingCalories = targetAvailable
      ? Math.max(0, targetCalories - consumedCalories)
      : 0
    const progress =
      targetAvailable && targetCalories > 0
        ? Math.min(consumedCalories / targetCalories, 1)
        : 0
    const waterProgress =
      waterGoalMl > 0 ? Math.min(Math.max(0, waterMl) / waterGoalMl, 1) : 0
    const showQuickWater = shouldShowHomeQuickWaterButton(waterMl, waterGoalMl)
    const waterGoalReached = waterMl >= waterGoalMl

    return {
      onboardingComplete: nutrition.profile.onboardingComplete,
      targetAvailable,
      targetCalories,
      remainingCalories,
      consumedCalories,
      progress,
      waterMl,
      waterGoalMl,
      waterProgress,
      showQuickWater,
      waterGoalReached,
    }
  }, [tick])

  const handleQuickWater = () => {
    if (!canSubmitHomeQuickWater(waterSaving)) return
    setWaterSaving(true)
    const result = tryAddHomeQuickWater()
    setWaterSaving(false)
    if (result.ok) {
      setTick((n) => n + 1)
      showToast(`${HOME_QUICK_WATER_ML} ml ajoutés`)
      return
    }
    showToast(result.message, 'error')
  }

  if (!snapshot.onboardingComplete) {
    return (
      <section className="glass-card rounded-2xl p-4" aria-label="Nutrition">
        <p className="text-[11px] font-medium text-[#8E8E93]">Nutrition</p>
        <p className="mt-2 text-[14px] leading-snug text-[#AEAEB2]">
          Configure ton plan dans l&apos;onglet Nutri pour voir ton suivi.
        </p>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-4" aria-label="Nutrition du jour">
      <div>
        <p className="text-[11px] font-medium text-[#8E8E93]">Aujourd&apos;hui</p>
        {snapshot.targetAvailable ? (
          <>
            <p className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-white">
              Il te reste {snapshot.remainingCalories.toLocaleString('fr-FR')} kcal
            </p>
            <p className="mt-1 text-[13px] text-[#AEAEB2]">
              {Math.round(snapshot.consumedCalories).toLocaleString('fr-FR')} consommées sur{' '}
              {snapshot.targetCalories.toLocaleString('fr-FR')}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[17px] font-semibold text-white">Objectif indisponible</p>
            <p className="mt-1 text-[13px] text-[#AEAEB2]">Ouvre Nutri pour vérifier ton plan.</p>
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
              className="h-full rounded-full bg-gradient-to-r from-[#B91C1C] to-[#FF2B2B] transition-all duration-500"
              style={{ width: `${snapshot.progress * 100}%` }}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenNutrition}
          disabled={!onOpenNutrition}
          aria-label="Ajouter un repas"
          className="btn-brand ios-press mt-4 min-h-11 w-full rounded-2xl border border-white/15 px-3 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E] disabled:opacity-50"
        >
          Ajouter un repas
        </button>
      </div>

      <div className="mt-4 border-t border-white/8 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#8E8E93]">Eau</p>
            {snapshot.waterGoalReached ? (
              <p className="mt-0.5 text-[15px] font-semibold text-[#7DD3FC]">Objectif atteint</p>
            ) : (
              <p className="mt-0.5 text-[15px] font-semibold text-white">
                {formatWaterMl(snapshot.waterMl)} sur {formatWaterMl(snapshot.waterGoalMl)}
              </p>
            )}
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={Math.round(snapshot.waterProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression hydrique"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0891B2] to-[#38BDF8] transition-all duration-500"
                style={{ width: `${Math.min(snapshot.waterProgress * 100, 100)}%` }}
              />
            </div>
          </div>

          {snapshot.showQuickWater ? (
            <button
              type="button"
              onClick={handleQuickWater}
              disabled={!canSubmitHomeQuickWater(waterSaving)}
              aria-label="J'ai bu 250 ml"
              className="ios-press min-h-11 shrink-0 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-3.5 py-2.5 text-[14px] font-semibold text-[#7DD3FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E] disabled:opacity-50"
            >
              +250 ml
            </button>
          ) : null}
        </div>
      </div>

      {toast ? (
        <p
          className={`mt-3 text-center text-[12px] font-medium ${
            toast.variant === 'error' ? 'text-[#FF6961]' : 'text-[#30D158]'
          }`}
          role={toast.variant === 'error' ? 'alert' : 'status'}
          aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
        >
          {toast.message}
        </p>
      ) : null}
    </section>
  )
}
