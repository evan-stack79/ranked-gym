import { useCallback, useEffect, useState } from 'react'
import { NutritionOnboarding } from './NutritionOnboarding'
import { NutritionDashboard } from './NutritionDashboard'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import { useAuth } from '../../context/AuthContext'
import type { CalorieProfile } from '../../types/nutrition'
import { HomeBootSkeleton } from '../ui/AppBootScreen'
import { isCalorieGoalEnabled } from '../../backend/calorieGoalFeatureFlag'
import { isMinorAge, readHealthDeclarations } from '../../services/nutritionSafetyRules'
import {
  HealthSituationsForm,
  healthSituationsFromProfile,
} from '../settings/HealthSituationsForm'
import { EnergyRecoveryInfo } from '../settings/EnergyRecoveryInfo'
import { M_INFO_1, M_MIN_1, Q6A_MINEURS, Q6B_GROSSESSE_ALLAITEMENT } from '../../content/safetyCopy'

function MinorNutritionScreen() {
  return (
    <div className="flex flex-col gap-4 pb-2" data-testid="minor-nutrition-screen">
      <header>
        <h1 className="text-[34px] font-bold tracking-tight text-white">Nutrition</h1>
      </header>
      <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{Q6A_MINEURS}</p>
      <p className="text-[15px] leading-relaxed text-[#AEAEB2]">{M_MIN_1}</p>
    </div>
  )
}

export function NutritionView() {
  const { isLoading: isBootLoading } = useAuth()
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())
  const [showSetupEditor, setShowSetupEditor] = useState(false)
  const calorieGoalEnabled = isCalorieGoalEnabled()

  useEffect(() => {
    if (isBootLoading) return
    setProfile(getCalorieProfile())
  }, [isBootLoading])

  useEffect(() => {
    const sync = () => setProfile(getCalorieProfile())
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('ranked-gym:profile-changed', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('ranked-gym:profile-changed', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const handleProfileChange = useCallback((next: CalorieProfile) => {
    setProfile(next)
    saveCalorieProfile(next)
  }, [])

  const handleSetupComplete = useCallback(
    (next: CalorieProfile) => {
      handleProfileChange(next)
      setShowSetupEditor(false)
    },
    [handleProfileChange],
  )

  if (isBootLoading) return <HomeBootSkeleton />

  if (isMinorAge(profile.age)) {
    return <MinorNutritionScreen />
  }

  const declarations = readHealthDeclarations(profile)

  if (showSetupEditor && calorieGoalEnabled) {
    return (
      <div className="flex flex-col gap-6 pb-2">
        <header>
          <h1 className="text-[34px] font-bold tracking-tight text-white">Nutrition</h1>
          <p className="mt-2 text-[15px] text-[#AEAEB2]">
            Ajuste ton objectif et ton plan calorique.
          </p>
        </header>
        <NutritionOnboarding initial={profile} onComplete={handleSetupComplete} />
        <EnergyRecoveryInfo />
        <HealthSituationsForm
          value={healthSituationsFromProfile(profile)}
          onChange={(next) => handleProfileChange({ ...profile, ...next })}
        />
        <p className="text-[12px] text-[#8E8E93]">
          Ressources d&apos;écoute : Réglages → Besoin d&apos;en parler ?
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {(declarations.pregnancy || declarations.breastfeeding) && (
        <p className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3 text-[13px] leading-relaxed text-[#EBEBF5]">
          {Q6B_GROSSESSE_ALLAITEMENT}
        </p>
      )}
      {!calorieGoalEnabled && (
        <p
          className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3 text-[13px] leading-relaxed text-[#AEAEB2]"
          data-testid="calorie-goal-disabled-notice"
        >
          {M_INFO_1}
        </p>
      )}
      <NutritionDashboard
        profile={profile}
        onChangeProfile={handleProfileChange}
        onOpenSetup={() => {
          if (calorieGoalEnabled) setShowSetupEditor(true)
        }}
      />
    </div>
  )
}
