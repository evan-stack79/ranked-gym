import { useState } from 'react'
import { SportsMultiSelect } from './SportsMultiSelect'
import { getTrainingState, setTrainingSports } from '../../services/trainingStorage'

interface SportsOnboardingScreenProps {
  onComplete: () => void
}

export function SportsOnboardingScreen({ onComplete }: SportsOnboardingScreenProps) {
  const initial = getTrainingState()
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initial.sportsOnboardingComplete === true && !initial.sportsUndecided) {
      return initial.favoriteSportIds
    }
    return []
  })

  const persistAndContinue = (ids: string[], undecided = false) => {
    setTrainingSports(ids, { undecided })
    onComplete()
  }

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-[#0C0C0E] font-sans"
      data-sports-onboarding
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <header className="border-b border-white/5 bg-[#0C0C0E]">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Ranked <span className="text-[#FF2B2B]">Gym</span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pb-5 pt-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
          Quels sports pratiques-tu ou aimerais-tu commencer ?
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[#8E8E93]">
          Tu pourras modifier ce choix plus tard dans ton profil.
        </p>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <SportsMultiSelect selectedIds={selectedIds} onChange={setSelectedIds} />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={selectedIds.length < 1}
            onClick={() => persistAndContinue(selectedIds)}
            className="btn-brand ios-press flex min-h-11 w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-white disabled:opacity-40"
          >
            Continuer
          </button>
          <button
            type="button"
            onClick={() => persistAndContinue([], true)}
            className="ios-press flex min-h-11 w-full items-center justify-center rounded-2xl text-[14px] font-medium text-[#8E8E93]"
          >
            Je ne sais pas encore
          </button>
        </div>
      </main>
    </div>
  )
}
