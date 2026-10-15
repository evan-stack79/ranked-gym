import { useState } from 'react'
import { YourDataMealsErasePanel } from '../components/settings/YourDataMealsEraseCard'

/**
 * Fixture démo : section « Tes données » avec compteur.
 * Route: /your-data-meals-fixture
 */
export function YourDataMealsEraseFixture() {
  const [serverCount, setServerCount] = useState(12)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-[#0C0C0E] px-4 py-8 text-white">
      <h1 className="text-[28px] font-bold tracking-tight">Sécurité & Confidentialité</h1>
      <p className="mt-1 text-[14px] text-[#8E8E93]">Compte, Mode Furtif & données</p>
      <div className="mt-6">
        <YourDataMealsErasePanel
          serverCount={serverCount}
          pendingCount={2}
          countMode="ready"
          confirmOpen={confirmOpen}
          onConfirmOpenChange={setConfirmOpen}
          onRequestErase={() => {
            setServerCount(0)
            setConfirmOpen(false)
          }}
        />
      </div>
    </div>
  )
}
