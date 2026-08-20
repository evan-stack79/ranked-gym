import { useCallback, useEffect, useState } from 'react'
import { Leaf, Droplets, RotateCcw } from 'lucide-react'
import { NutritionOnboarding } from './NutritionOnboarding'
import { NutritionPlanCard } from './NutritionPlanCard'
import { MealJournal } from './MealJournal'
import { IconBadge } from '../ui/IconBadge'
import { computeCaloriePlan } from '../../utils/calories'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import { getAdjustedNutritionTarget } from '../../services/nutritionActivity'
import type { CalorieProfile } from '../../types/nutrition'

export function NutritionView() {
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())
  const [hydrated, setHydrated] = useState(false)
  const [targetCalories, setTargetCalories] = useState(
    () => getAdjustedNutritionTarget().targetCalories,
  )
  const [activityBonus, setActivityBonus] = useState(
    () => getAdjustedNutritionTarget().activityBonus,
  )

  const refreshTargets = useCallback(() => {
    const adjusted = getAdjustedNutritionTarget()
    setTargetCalories(adjusted.targetCalories)
    setActivityBonus(adjusted.activityBonus)
  }, [])

  useEffect(() => {
    const stored = getCalorieProfile()
    setProfile(stored)
    refreshTargets()
    setHydrated(true)
  }, [refreshTargets])

  useEffect(() => {
    if (!hydrated) return
    saveCalorieProfile(profile)
    refreshTargets()
  }, [profile, hydrated, refreshTargets])

  useEffect(() => {
    const onFocus = () => refreshTargets()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshTargets])

  const handleTargetChange = useCallback((value: number) => {
    setTargetCalories(value)
  }, [])

  const handleProfileChange = useCallback((next: CalorieProfile) => {
    setProfile(next)
    const plan = computeCaloriePlan(next)
    const adjusted = getAdjustedNutritionTarget()
    setTargetCalories(Math.max(1200, plan.targetCalories + (adjusted.activityBonus || 0)))
  }, [])

  const resetOnboarding = () => {
    const next = { ...profile, onboardingComplete: false }
    setProfile(next)
  }

  if (!hydrated) return null

  return (
    <div className="flex flex-col gap-8 pb-4">
      <header className="relative ios-fade-up">
        <div
          className="pointer-events-none absolute -left-8 -top-6 h-28 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #34C75944 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconBadge icon={Leaf} variant="green" size="sm" />
              <span className="rounded-full border border-[#34C759]/30 bg-[#34C759]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#30D158]">
                Fuel
              </span>
            </div>
            <h1 className="text-[34px] font-bold tracking-tight text-white">Nutrition</h1>
            <p className="mt-2 text-[17px] text-[#8E8E93]">
              {profile.onboardingComplete
                ? activityBonus > 0
                  ? `Plan +${activityBonus} kcal liés à ton activité Train.`
                  : 'Plan adapté à ton objectif et ta morphologie.'
                : 'Dis-nous ton objectif, on calcule le reste.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <IconBadge icon={Droplets} variant="blue" />
            {profile.onboardingComplete && (
              <button
                type="button"
                onClick={resetOnboarding}
                className="ios-press inline-flex items-center gap-1 text-[11px] font-medium text-[#636366]"
              >
                <RotateCcw className="h-3 w-3" />
                Refaire le setup
              </button>
            )}
          </div>
        </div>
      </header>

      {!profile.onboardingComplete ? (
        <NutritionOnboarding initial={profile} onComplete={handleProfileChange} />
      ) : (
        <>
          <div className="ios-fade-up ios-fade-up-delay-1">
            <NutritionPlanCard
              profile={profile}
              onChange={handleProfileChange}
              onTargetChange={handleTargetChange}
            />
          </div>
          <div className="ios-fade-up ios-fade-up-delay-2">
            <MealJournal targetCalories={targetCalories} morphology={profile.morphology} />
          </div>
        </>
      )}
    </div>
  )
}
