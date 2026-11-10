import { useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { RankUpCelebrationOverlay } from './RankUpCelebrationOverlay'

/**
 * Hôte persistant — monte la célébration de montée de rang au niveau AppLayout.
 */
export function RankUpCelebrationHost() {
  const { rankUpCelebration, clearRankUpCelebration } = useAuth()

  const handleFinalize = useCallback(() => {
    clearRankUpCelebration()
  }, [clearRankUpCelebration])

  if (!rankUpCelebration) return null

  return (
    <RankUpCelebrationOverlay
      key={`${rankUpCelebration.previousLevel}-${rankUpCelebration.nextLevel}`}
      previousLevel={rankUpCelebration.previousLevel}
      nextLevel={rankUpCelebration.nextLevel}
      currentXp={rankUpCelebration.currentXp}
      onComplete={handleFinalize}
    />
  )
}
