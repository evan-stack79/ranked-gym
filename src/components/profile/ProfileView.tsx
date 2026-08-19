import { useEffect, useState } from 'react'
import { FighterHeader } from './FighterHeader'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { currentUser } from '../../data/mockData'
import { getProfileProgress, saveProfileProgress } from '../../services/profileStorage'
import { getRankFromLevel } from '../../utils/rank'
import type { StoredProfileProgress } from '../../services/profileStorage'

export function ProfileView() {
  const [progress, setProgress] = useState<StoredProfileProgress>(() => getProfileProgress())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setProgress(getProfileProgress())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) {
      saveProfileProgress(progress)
    }
  }, [progress, hydrated])

  const rank = getRankFromLevel(progress.level)

  return (
    <div className="flex flex-col gap-5 pb-2">
      <FighterHeader username={currentUser.username} title={rank.title} />

      <RankShowcase rank={rank} level={progress.level} />

      <ProfileXPBar
        level={progress.level}
        currentXp={progress.currentXp}
        xpToNextLevel={progress.xpToNextLevel}
      />

      <StatGrid />

      <BadgeShowcase />
    </div>
  )
}
