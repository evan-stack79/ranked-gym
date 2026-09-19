import { useCallback, useEffect, useState } from 'react'
import { NutritionOnboarding } from './NutritionOnboarding'
import { NutritionDashboard } from './NutritionDashboard'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import { useAuth } from '../../context/AuthContext'
import type { CalorieProfile } from '../../types/nutrition'

export function NutritionView() {
  const { isLoading: isBootLoading } = useAuth()
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())
  const [showSetupEditor, setShowSetupEditor] = useState(false)

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

  if (isBootLoading) return null

  if (showSetupEditor) {
    return (
      <div className="flex flex-col gap-6 pb-2">
        <header>
          <h1 className="text-[34px] font-bold tracking-tight text-white">Nutrition</h1>
          <p className="mt-2 text-[15px] text-[#AEAEB2]">
            Ajuste ton objectif et ton plan calorique.
          </p>
        </header>
        <NutritionOnboarding initial={profile} onComplete={handleSetupComplete} />
      </div>
    )
  }

  return (
    <NutritionDashboard
      profile={profile}
      onChangeProfile={handleProfileChange}
      onOpenSetup={() => setShowSetupEditor(true)}
    />
  )
}
