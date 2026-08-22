import { useCallback, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { NutritionOnboarding } from '../nutrition/NutritionOnboarding'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import type { CalorieProfile } from '../../types/nutrition'

interface GlobalOnboardingScreenProps {
  onComplete: () => void
}

export function GlobalOnboardingScreen({ onComplete }: GlobalOnboardingScreenProps) {
  const [profile, setProfile] = useState<CalorieProfile>(() => getCalorieProfile())

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
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="arena-glow absolute -left-[30%] -top-[20%] h-[70vh] w-[90vw] rounded-full blur-[90px]"
          style={{ background: 'radial-gradient(circle, #5C1018 0%, #FF2B2B33 35%, transparent 70%)' }}
        />
        <div
          className="arena-glow absolute -right-[25%] top-[-5%] h-[60vh] w-[75vw] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, #0A1A40 0%, #00B4FF28 40%, transparent 72%)',
            animationDelay: '3s',
          }}
        />
      </div>

      <header className="glass-bar relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Ranked <span className="text-[#FF2B2B]">Gym</span>
          </span>
        </div>
      </header>

      <main
        className="relative z-10 mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 pb-8 pt-6"
      >
        <header className="mb-8 ios-fade-up">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
            Ton plan sur mesure
          </h1>
          <p className="mt-2 flex items-start gap-2 text-[15px] leading-snug text-[#8E8E93]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD60A]" />
            Objectif, morphologie et rythme — on calcule tes calories et macros.
          </p>
        </header>

        <NutritionOnboarding initial={profile} onComplete={handleComplete} />
      </main>
    </div>
  )
}
