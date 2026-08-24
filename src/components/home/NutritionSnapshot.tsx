import { useEffect, useMemo, useState } from 'react'
import { Leaf } from 'lucide-react'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { getCalorieProfile, getTodayJournal, getTodayWaterMl } from '../../services/nutritionStorage'
import { getDailyWaterGoalMl, isTrainingDayToday } from '../../utils/waterGoal'
import { HydrationProgressBar } from '../nutrition/HydrationProgressBar'
import { IconBadge } from '../ui/IconBadge'

function MacroPill({
  label,
  current,
  target,
  color,
}: {
  label: string
  current: number
  target: number
  color: string
}) {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0
  const remaining = Math.max(0, target - current)

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-semibold text-[#AEAEB2]">
        {remaining > 0 ? `${Math.round(remaining)}g` : 'OK'}
      </span>
    </div>
  )
}

export function NutritionSnapshot() {
  const [tick, setTick] = useState(0)

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
    }
  }, [])

  const snapshot = useMemo(() => {
    const nutrition = getNutritionTarget()
    const profile = getCalorieProfile()
    const meals = getTodayJournal().meals
    const waterMl = getTodayWaterMl()
    const isTrainingDay = isTrainingDayToday()
    const waterGoalMl = getDailyWaterGoalMl(profile.weightKg, isTrainingDay)
    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + (meal.proteinG ?? 0),
        carbs: acc.carbs + (meal.carbsG ?? 0),
        fat: acc.fat + (meal.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )

    const targetCalories = nutrition.targetCalories
    const remainingCalories = Math.max(0, targetCalories - totals.calories)
    const progress = targetCalories > 0 ? Math.min(totals.calories / targetCalories, 1) : 0

    return {
      onboardingComplete: nutrition.profile.onboardingComplete,
      targetCalories,
      remainingCalories,
      progress,
      proteinTarget: nutrition.proteinG,
      carbsTarget: nutrition.carbsG,
      fatTarget: nutrition.fatG,
      totals,
      waterMl,
      waterGoalMl,
      isTrainingDay,
    }
  }, [tick])

  if (!snapshot.onboardingComplete) {
    return (
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={Leaf} variant="green" size="sm" />
          <div>
            <p className="text-[13px] font-semibold text-white">Nutrition</p>
            <p className="text-[12px] text-[#8E8E93]">
              Configure ton plan dans l&apos;onglet Nutri pour voir ton snapshot.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconBadge icon={Leaf} variant="green" size="sm" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Nutrition
            </p>
            <p className="text-[15px] font-bold text-white">
              {snapshot.remainingCalories.toLocaleString('fr-FR')} kcal restantes
            </p>
          </div>
        </div>
        <span className="text-[12px] text-[#636366]">
          {Math.round(snapshot.totals.calories)} / {snapshot.targetCalories}
        </span>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#34C759] to-[#30D158] transition-all duration-500"
          style={{ width: `${snapshot.progress * 100}%` }}
        />
      </div>

      <HydrationProgressBar
        className="mb-3"
        compact
        consumedMl={snapshot.waterMl}
        goalMl={snapshot.waterGoalMl}
        isTrainingDay={snapshot.isTrainingDay}
      />

      <div className="flex gap-3">
        <MacroPill
          label="P"
          current={snapshot.totals.protein}
          target={snapshot.proteinTarget}
          color="#FF6961"
        />
        <MacroPill
          label="G"
          current={snapshot.totals.carbs}
          target={snapshot.carbsTarget}
          color="#FFD60A"
        />
        <MacroPill
          label="L"
          current={snapshot.totals.fat}
          target={snapshot.fatTarget}
          color="#64D2FF"
        />
      </div>
    </section>
  )
}
