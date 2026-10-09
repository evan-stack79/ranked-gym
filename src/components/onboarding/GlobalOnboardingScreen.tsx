import { useCallback, useState } from 'react'
import { NutritionOnboarding } from '../nutrition/NutritionOnboarding'
import { InscriptionFlow } from './InscriptionFlow'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import type { CalorieProfile } from '../../types/nutrition'
import { isCalorieGoalEnabled } from '../../backend/calorieGoalFeatureFlag'

interface GlobalOnboardingScreenProps {
  onComplete: () => void
}

/**
 * Shell d'inscription.
 * Drapeau calorie OFF (défaut) → InscriptionFlow une question / écran.
 * Drapeau ON → NutritionOnboarding assistant (inchangé).
 */
export function GlobalOnboardingScreen({ onComplete }: GlobalOnboardingScreenProps) {
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())
  const calorieGoalEnabled = isCalorieGoalEnabled()

  const handleComplete = useCallback(
    (next: CalorieProfile) => {
      saveCalorieProfile(next)
      setProfile(next)
      onComplete()
    },
    [onComplete],
  )

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col mesh-bg font-sans"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      data-testid="global-onboarding"
      data-calorie-goal={calorieGoalEnabled ? 'on' : 'off'}
    >
      <header className="glass-bar relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Ranked <span className="text-[#FF2B2B]">Gym</span>
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pb-8 pt-6">
        {calorieGoalEnabled ? (
          <NutritionOnboarding initial={profile} onComplete={handleComplete} />
        ) : (
          <InscriptionFlow initial={profile} onComplete={handleComplete} />
        )}
      </main>
    </div>
  )
}
