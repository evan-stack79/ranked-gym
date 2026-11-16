import { useState } from 'react'
import { SleepNightSummaryCard } from './SleepNightSummaryCard'
import { SleepScreen } from './SleepScreen'

/**
 * Accueil — bloc résumé Sommeil en haut (v10).
 * 1 source de données via SleepNightSummaryCard.
 */
export function SleepSnapshot() {
  const [screenOpen, setScreenOpen] = useState(false)

  return (
    <div data-sleep-home-card>
      <SleepNightSummaryCard
        variant="accueil"
        showAction
        onOpenSleepScreen={() => setScreenOpen(true)}
      />
      <SleepScreen open={screenOpen} onClose={() => setScreenOpen(false)} />
    </div>
  )
}
