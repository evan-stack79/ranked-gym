import { useState } from 'react'
import { InscriptionFlow } from '../components/onboarding/InscriptionFlow'
import { BLANK_PROFILE } from '../services/nutritionStorage'
import type { CalorieProfile } from '../types/nutrition'

/**
 * QA fixture for one-question inscription capture @ 390×844.
 * Route: /inscription-fixture
 */
export function InscriptionFixture() {
  const [done, setDone] = useState<CalorieProfile | null>(null)

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col mesh-bg font-sans"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      data-inscription-fixture="1"
    >
      <header className="glass-bar relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Ranked <span className="text-[#FF2B2B]">Gym</span>
          </span>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pb-8 pt-6">
        {done ? (
          <div className="py-10 text-center text-white" data-testid="inscription-fixture-done">
            Inscription terminée
          </div>
        ) : (
          <InscriptionFlow
            initial={{ ...BLANK_PROFILE }}
            onComplete={(p) => setDone(p)}
          />
        )}
      </main>
    </div>
  )
}
